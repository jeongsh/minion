import type { SupabaseClient } from "@supabase/supabase-js";

import {
  scrapeInstagramPosts,
  scrapeInstagramStories,
} from "../scraper/instagram-browser.ts";

export type SyncEngine = "browser" | "auto";

// ─── 공통 타입 ──────────────────────────────────────────────────

export interface InstagramOwner {
  kind: "player" | "team";
  id: string;
  name: string;
  instagramUrl: string | null;
  teamId?: string | null;
}

export interface NormalizedPost {
  postId: string;
  shortcode: string;
  imageUrl: string;
  caption: string;
  postedAt: Date;
  likesCount: number;
  commentsCount: number;
  sourceUrl: string;
}

export interface NormalizedStory {
  storyPk: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl?: string;
  takenAt: Date;
  expiresAt: Date;
}

// ─── 이미지 영구 저장 (Supabase Storage) ─────────────────────────

export const INSTAGRAM_MEDIA_BUCKET = "instagram-media";

const IMAGE_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Referer: "https://www.instagram.com/",
};

export function isStoredImageUrl(url: string): boolean {
  return url.includes(`/storage/v1/object/public/${INSTAGRAM_MEDIA_BUCKET}/`);
}

function sanitizeStorageKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

/**
 * 인스타 CDN 이미지를 내려받아 Supabase Storage(instagram-media)에 올리고
 * 만료되지 않는 공개 URL을 돌려준다. 실패하면 null.
 * 이미 우리 스토리지 URL이면 그대로 반환한다.
 */
export async function storeInstagramImage(
  supabase: SupabaseClient,
  key: string,
  sourceUrl: string | null | undefined,
): Promise<string | null> {
  if (!sourceUrl) return null;
  if (isStoredImageUrl(sourceUrl)) return sourceUrl;

  try {
    const res = await fetch(sourceUrl, { headers: IMAGE_FETCH_HEADERS });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const path = `posts/${sanitizeStorageKey(key)}.${ext}`;

    const { error } = await supabase.storage
      .from(INSTAGRAM_MEDIA_BUCKET)
      .upload(path, await res.arrayBuffer(), { contentType, upsert: true });
    if (error) return null;

    const { data } = supabase.storage.from(INSTAGRAM_MEDIA_BUCKET).getPublicUrl(path);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}

// ─── DB 헬퍼 ────────────────────────────────────────────────────

/** source_url(.../p/{shortcode}/, /reel/, /tv/)에서 shortcode를 뽑는다. */
export function extractShortcode(sourceUrl: string): string | null {
  try {
    const { pathname } = new URL(sourceUrl);
    return pathname.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function extractUsername(instagramUrl: string): string {
  const trimmed = instagramUrl.trim();
  if (!trimmed.includes("instagram.com")) return trimmed.replace(/^@/, "");
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.pathname.split("/").filter(Boolean)[0] ?? trimmed;
  } catch {
    return trimmed;
  }
}

export async function getInstagramOwners(supabase: SupabaseClient): Promise<InstagramOwner[]> {
  const [{ data: players }, { data: teams }] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, instagram_url, team_id, teams!inner(is_lck_team)")
      .not("instagram_url", "is", null)
      .eq("is_active", true)
      .eq("teams.is_lck_team", true),
    supabase
      .from("teams")
      .select("id, short_name, official_instagram_url")
      .not("official_instagram_url", "is", null)
      .eq("is_active", true)
      .eq("is_lck_team", true),
  ]);

  return [
    ...(players ?? []).map((p) => ({
      kind: "player" as const,
      id: p.id,
      name: p.name,
      instagramUrl: p.instagram_url,
      teamId: p.team_id,
    })),
    ...(teams ?? []).map((t) => ({
      kind: "team" as const,
      id: t.id,
      name: t.short_name,
      instagramUrl: t.official_instagram_url,
      teamId: t.id,
    })),
  ];
}

// ─── upsert: 게시물 ──────────────────────────────────────────────

export async function syncOwnerPosts(
  supabase: SupabaseClient,
  owner: InstagramOwner,
  opts: { dryRun?: boolean; engine?: SyncEngine; sessionCookie?: string } = {},
): Promise<{ inserted: number; checked: number }> {
  const username = extractUsername(owner.instagramUrl!);
  const posts = await scrapeInstagramPosts(username, opts.sessionCookie);

  if (opts.dryRun) return { inserted: 0, checked: posts.length };

  let inserted = 0;
  for (const post of posts) {
    if (owner.kind === "player") {
      const { data, error } = await supabase
        .from("player_social_posts")
        .upsert(
          {
            player_id: owner.id,
            team_id: owner.teamId ?? null,
            platform: "instagram",
            post_id: post.postId,
            caption: post.caption,
            source_url: post.sourceUrl,
            image_url: post.imageUrl || null,
            likes_count: post.likesCount,
            comments_count: post.commentsCount,
            posted_at: post.postedAt.toISOString(),
            scraped_at: new Date().toISOString(),
          },
          { onConflict: "source_url", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      // 새로 추가된 게시물만 이미지를 영구 저장(만료 전 신선한 URL을 즉시 보관).
      if (data?.length) {
        inserted += data.length;
        const stored = await storeInstagramImage(
          supabase,
          `player_${post.shortcode || post.postId}`,
          post.imageUrl,
        );
        if (stored && stored !== post.imageUrl) {
          await supabase.from("player_social_posts").update({ image_url: stored }).eq("id", data[0].id);
        }
      }
    } else {
      const { data, error } = await supabase
        .from("team_social_posts")
        .upsert(
          {
            team_id: owner.id,
            platform: "instagram",
            title: post.caption.slice(0, 200) || "Instagram post",
            content: post.caption,
            source_url: post.sourceUrl,
            thumbnail_url: post.imageUrl || null,
            published_at: post.postedAt.toISOString(),
          },
          { onConflict: "source_url", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      if (data?.length) {
        inserted += data.length;
        const stored = await storeInstagramImage(
          supabase,
          `team_${post.shortcode || post.postId}`,
          post.imageUrl,
        );
        if (stored && stored !== post.imageUrl) {
          await supabase.from("team_social_posts").update({ thumbnail_url: stored }).eq("id", data[0].id);
        }
      }
    }
  }

  return { inserted, checked: posts.length };
}

// ─── 1회용: 기존 게시물 이미지 복구 ──────────────────────────────
// 프로필을 새로 스크랩해, DB에 있는 게시물 중 아직 Storage 이미지가 없는
// 항목을 신선한 URL로 내려받아 저장한다. (만료된 기존 이미지 치료용)

export async function restoreOwnerImages(
  supabase: SupabaseClient,
  owner: InstagramOwner,
  opts: { dryRun?: boolean; sessionCookie?: string } = {},
): Promise<{ checked: number; restored: number; missingInDb: number }> {
  const username = extractUsername(owner.instagramUrl!);
  const posts = await scrapeInstagramPosts(username, opts.sessionCookie);

  let restored = 0;
  let missingInDb = 0;
  for (const post of posts) {
    if (owner.kind === "player") {
      const { data } = await supabase
        .from("player_social_posts")
        .select("id, image_url")
        .eq("source_url", post.sourceUrl)
        .maybeSingle();
      if (!data) {
        missingInDb += 1;
        continue;
      }
      if (data.image_url && isStoredImageUrl(data.image_url)) continue;
      if (opts.dryRun) {
        restored += 1;
        continue;
      }
      const stored = await storeInstagramImage(
        supabase,
        `player_${post.shortcode || post.postId}`,
        post.imageUrl,
      );
      if (stored && stored !== post.imageUrl) {
        await supabase.from("player_social_posts").update({ image_url: stored }).eq("id", data.id);
        restored += 1;
      }
    } else {
      const { data } = await supabase
        .from("team_social_posts")
        .select("id, thumbnail_url")
        .eq("source_url", post.sourceUrl)
        .maybeSingle();
      if (!data) {
        missingInDb += 1;
        continue;
      }
      if (data.thumbnail_url && isStoredImageUrl(data.thumbnail_url)) continue;
      if (opts.dryRun) {
        restored += 1;
        continue;
      }
      const stored = await storeInstagramImage(
        supabase,
        `team_${post.shortcode || post.postId}`,
        post.imageUrl,
      );
      if (stored && stored !== post.imageUrl) {
        await supabase.from("team_social_posts").update({ thumbnail_url: stored }).eq("id", data.id);
        restored += 1;
      }
    }
  }

  return { checked: posts.length, restored, missingInDb };
}

// ─── upsert: 스토리 ──────────────────────────────────────────────

export async function syncOwnerStories(
  supabase: SupabaseClient,
  owner: InstagramOwner,
  opts: { dryRun?: boolean; engine?: SyncEngine; sessionCookie?: string } = {},
): Promise<{ inserted: number; checked: number; newStories: NormalizedStory[] }> {
  const username = extractUsername(owner.instagramUrl!);
  const stories = await scrapeInstagramStories(username, opts.sessionCookie);

  if (opts.dryRun) return { inserted: 0, checked: stories.length, newStories: [] };

  // 만료된 스토리 삭제
  await supabase
    .from("instagram_stories")
    .delete()
    .eq("owner_type", owner.kind)
    .eq("owner_id", owner.id)
    .lt("expires_at", new Date().toISOString());

  // 새 스토리 감지용: upsert 전 기존 story_pk 조회
  const { data: existing } = await supabase
    .from("instagram_stories")
    .select("story_pk")
    .eq("owner_type", owner.kind)
    .eq("owner_id", owner.id);
  const existingPks = new Set((existing ?? []).map((r) => r.story_pk as string));
  const newStories = stories.filter((s) => !existingPks.has(s.storyPk));

  let inserted = 0;
  for (const story of stories) {
    const { data, error } = await supabase
      .from("instagram_stories")
      .upsert(
        {
          owner_type: owner.kind,
          owner_id: owner.id,
          team_id: owner.kind === "team" ? owner.id : (owner.teamId ?? null),
          story_pk: story.storyPk,
          media_url: story.mediaUrl,
          media_type: story.mediaType,
          thumbnail_url: story.thumbnailUrl ?? null,
          expires_at: story.expiresAt.toISOString(),
          taken_at: story.takenAt.toISOString(),
          scraped_at: new Date().toISOString(),
        },
        { onConflict: "owner_type, owner_id, story_pk", ignoreDuplicates: false },
      )
      .select("id");
    if (error) throw error;
    inserted += data?.length ?? 0;
  }

  return { inserted, checked: stories.length, newStories };
}
