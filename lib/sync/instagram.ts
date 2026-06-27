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

// ─── DB 헬퍼 ────────────────────────────────────────────────────

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
      .select("id, name, instagram_url, team_id")
      .not("instagram_url", "is", null)
      .eq("is_active", true),
    supabase
      .from("teams")
      .select("id, short_name, official_instagram_url")
      .not("official_instagram_url", "is", null)
      .eq("is_active", true),
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
      inserted += data?.length ?? 0;
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
      inserted += data?.length ?? 0;
    }
  }

  return { inserted, checked: posts.length };
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
