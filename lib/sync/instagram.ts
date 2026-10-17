import type { SupabaseClient } from "@supabase/supabase-js";

import { resizeImageForWeb } from "../images/resize-for-web.ts";
import { notifyTeamContentUpdate } from "../notifications/team-content.ts";
import { isR2Url, uploadToR2 } from "../storage/r2.ts";
import { fetchInstagramGraphPages } from "../scraper/instagram-graph.ts";
import type { InstagramRun } from "./instagram-control.ts";

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

// ─── 이미지 영구 저장 (Supabase Storage) ─────────────────────────

export const INSTAGRAM_MEDIA_BUCKET = "instagram-media";

export function isStoredImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port
      && (isR2Url(url) || (parsed.hostname === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
        && parsed.pathname.startsWith(`/storage/v1/object/public/${INSTAGRAM_MEDIA_BUCKET}/`)));
  } catch { return false; }
}

function sanitizeStorageKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

/**
 * 인스타 CDN 이미지를 내려받아 R2(instagram-media)에 올리고
 * 만료되지 않는 공개 URL을 돌려준다. API에 이미지가 없으면 null, 다운로드나 저장 실패는 오류로 보고한다.
 * 이미 우리 스토리지 URL이면 그대로 반환한다.
 */
export async function storeInstagramImage(
  key: string,
  sourceUrl: string | null | undefined,
): Promise<string | null> {
  if (!sourceUrl) return null;
  if (isStoredImageUrl(sourceUrl)) return sourceUrl;

  const url = new URL(sourceUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !["cdninstagram.com", "fbcdn.net"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new Error("INSTAGRAM_MEDIA_STOP: non-CDN URL rejected");
  }
  try {
    const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error("CDN response failed");

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) throw new Error("Invalid image response");
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 10 * 1024 * 1024) throw new Error("Image exceeds 10 MiB");

    // 인스타 CDN 원본을 그대로 영구 저장하면 피드/모자이크에서 실제 표시 크기보다
    // 훨씬 큰 파일이 계속 서빙된다. 인스타 피드 사진 자체가 1080px를 넘지 않아
    // 화질 손실 없이 줄일 수 있다.
    const resized = await resizeImageForWeb(bytes, contentType, { maxEdge: 1080 });
    const ext = resized.transformed
      ? resized.extension
      : contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
    const path = `posts/${sanitizeStorageKey(key)}.${ext}`;

    return await uploadToR2(path, resized.bytes, resized.contentType, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error("INSTAGRAM_MEDIA_STOP: image download/storage failed; no retry");
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

export function extractUsername(instagramUrl: string): string {
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
  const [{ data: players, error: playersError }, { data: teams, error: teamsError }] = await Promise.all([
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
  if (playersError) throw playersError;
  if (teamsError) throw teamsError;

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

export class InstagramSyncError extends Error {
  inserted: number;
  checked: number;
  constructor(cause: unknown, inserted: number, checked: number) {
    super(cause instanceof Error ? cause.message : "Instagram storage failed");
    this.inserted = inserted;
    this.checked = checked;
  }
}

export async function syncOwnerPosts(
  supabase: SupabaseClient,
  owner: InstagramOwner,
  opts: { dryRun?: boolean; noNotify?: boolean; maxPosts?: number; run: InstagramRun; full?: boolean },
): Promise<{ inserted: number; checked: number }> {
  const username = extractUsername(owner.instagramUrl!).toLowerCase();
  const player = owner.kind === "player";
  const table = player ? "player_social_posts" : "team_social_posts";
  const imageColumn = player ? "image_url" : "thumbnail_url";
  let inserted = 0;
  let checked = 0;
  try {
    for await (const posts of fetchInstagramGraphPages(username, opts.maxPosts ?? 60, opts.run)) {
      if (!posts.length) break;
      const { data: existing, error: readError } = await supabase.from(table)
        .select(`id,source_url,${imageColumn}`).eq("platform", "instagram")
        .eq(player ? "player_id" : "team_id", owner.id).in("source_url", posts.map(p => p.sourceUrl));
      if (readError) throw readError;
      const known = new Map((existing as unknown as Array<{ id: string; source_url: string; image_url?: string; thumbnail_url?: string }> ?? []).map(row => [row.source_url, row]));
      checked += posts.length;
      for (const post of posts) {
        if (opts.dryRun) continue;
        const prior = known.get(post.sourceUrl);
        const priorImage = prior?.[imageColumn];
        if (priorImage && isStoredImageUrl(priorImage)) continue;
        // Only fresh official API media URLs reach the downloader. Missing media is legitimate.
        opts.run.beforeRequest();
        const stored = await storeInstagramImage(`${owner.kind}_${post.shortcode}`, post.imageUrl);
        if (prior) {
          if (stored !== (priorImage ?? null)) {
            const { error } = await supabase.from(table).update({ [imageColumn]: stored }).eq("id", prior.id);
            if (error) throw error;
          }
          continue;
        }
        const row: Record<string, unknown> = player ? {
          player_id: owner.id, team_id: owner.teamId ?? null, platform: "instagram", post_id: post.postId,
          caption: post.caption, source_url: post.sourceUrl, image_url: stored,
          likes_count: post.likesCount, comments_count: post.commentsCount,
          posted_at: post.postedAt.toISOString(), scraped_at: new Date().toISOString(),
        } : {
          team_id: owner.id, platform: "instagram", title: Array.from(post.caption).slice(0, 200).join("") || "Instagram post",
          content: post.caption, source_url: post.sourceUrl, thumbnail_url: stored, published_at: post.postedAt.toISOString(),
        };
        const { data, error } = await supabase.from(table).upsert(row, { onConflict: "source_url", ignoreDuplicates: true }).select("id");
        if (error) throw error;
        inserted += data?.length ?? 0;
        if (data?.length && owner.teamId && !opts.noNotify) {
          try {
            await notifyTeamContentUpdate(supabase, { kind: "team_social", sourceId: data[0].id, teamId: owner.teamId,
              contentTitle: post.caption, imageUrl: stored, publishedAt: post.postedAt.toISOString() });
          } catch {
            console.error(`[team-content-notifications] ${owner.kind}:${owner.name} failed`);
          }
        }
      }
      console.log(`[graph-page] @${username} checked=${checked} new=${inserted}`);
      // A whole known page avoids stopping at a pinned old post.
      if (!opts.full && posts.every(post => known.has(post.sourceUrl))) break;
    }
  } catch (error) {
    throw new InstagramSyncError(error, inserted, checked);
  }
  return { inserted, checked };
}
