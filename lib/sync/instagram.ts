import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchUserFeed,
  fetchUserStories,
  getBestImageUrl,
  getCaption,
  getShortcode,
  type RapidApiMediaItem,
} from "@/lib/instagram-api";
import {
  scrapeInstagramPosts,
  scrapeInstagramStories,
} from "@/lib/scraper/instagram-browser";

export type SyncEngine = "browser" | "rapidapi" | "auto";

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

// ─── 파싱 ───────────────────────────────────────────────────────

function normalizePost(item: RapidApiMediaItem): NormalizedPost | null {
  if (!item.pk) return null;
  const shortcode = getShortcode(item);
  const imageUrl = getBestImageUrl(item);

  // carousel의 경우 첫 번째 미디어 이미지 사용
  const firstCarousel = item.carousel_media?.[0];
  const finalImageUrl = imageUrl || (firstCarousel ? getBestImageUrl(firstCarousel) : "");

  return {
    postId: item.pk,
    shortcode,
    imageUrl: finalImageUrl,
    caption: getCaption(item),
    postedAt: item.taken_at ? new Date(item.taken_at * 1000) : new Date(0),
    likesCount: item.like_count ?? 0,
    commentsCount: item.comment_count ?? 0,
    sourceUrl: `https://www.instagram.com/p/${shortcode}/`,
  };
}

function normalizeStory(item: RapidApiMediaItem): NormalizedStory | null {
  if (!item.pk) return null;
  const isVideo = item.media_type === 2;
  const mediaUrl = isVideo
    ? (item.video_url ?? getBestImageUrl(item))
    : getBestImageUrl(item);

  if (!mediaUrl) return null;

  const takenAt = item.taken_at ? new Date(item.taken_at * 1000) : new Date();
  // Instagram 스토리 만료: 24시간 (expiring_at 필드가 없으면 24h 후로 설정)
  const expiresAt = item.expiring_at
    ? new Date(item.expiring_at * 1000)
    : new Date(takenAt.getTime() + 24 * 60 * 60 * 1000);

  return {
    storyPk: item.pk,
    mediaUrl,
    mediaType: isVideo ? "video" : "image",
    thumbnailUrl: isVideo ? getBestImageUrl(item) : undefined,
    takenAt,
    expiresAt,
  };
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

// ─── 엔진별 데이터 가져오기 ──────────────────────────────────────

async function fetchPosts(
  username: string,
  engine: SyncEngine,
  sessionCookie?: string,
): Promise<NormalizedPost[]> {
  if (engine === "browser") {
    return scrapeInstagramPosts(username, sessionCookie);
  }
  if (engine === "rapidapi") {
    const items = await fetchUserFeed(username);
    return items.map(normalizePost).filter((p): p is NormalizedPost => p !== null);
  }
  // auto: browser 우선, RapidAPI는 fallback
  try {
    const posts = await scrapeInstagramPosts(username, sessionCookie);
    if (posts.length > 0) return posts;
  } catch {
    // browser 실패 시 RapidAPI 시도
  }
  try {
    const items = await fetchUserFeed(username);
    return items.map(normalizePost).filter((p): p is NormalizedPost => p !== null);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("MONTHLY") || msg.includes("quota")) throw err; // 할당량 소진 시 상위로 전파
    throw err;
  }
}

async function fetchStories(
  username: string,
  engine: SyncEngine,
  sessionCookie?: string,
): Promise<NormalizedStory[]> {
  if (engine === "browser") {
    return scrapeInstagramStories(username, sessionCookie);
  }
  if (engine === "rapidapi") {
    const items = await fetchUserStories(username);
    return items.map(normalizeStory).filter((s): s is NormalizedStory => s !== null);
  }
  // auto: browser 우선
  try {
    const stories = await scrapeInstagramStories(username, sessionCookie);
    if (stories.length > 0) return stories;
  } catch {
    // browser 실패 시 RapidAPI 시도
  }
  try {
    const items = await fetchUserStories(username);
    return items.map(normalizeStory).filter((s): s is NormalizedStory => s !== null);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("MONTHLY") || msg.includes("quota")) throw err;
    throw err;
  }
}

// ─── upsert: 게시물 ──────────────────────────────────────────────

export async function syncOwnerPosts(
  supabase: SupabaseClient,
  owner: InstagramOwner,
  opts: { dryRun?: boolean; engine?: SyncEngine; sessionCookie?: string } = {},
): Promise<{ inserted: number; checked: number }> {
  const username = extractUsername(owner.instagramUrl!);
  const engine = opts.engine ?? "auto";
  const posts = await fetchPosts(username, engine, opts.sessionCookie);

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
): Promise<{ inserted: number; checked: number }> {
  const username = extractUsername(owner.instagramUrl!);
  const engine = opts.engine ?? "auto";
  const stories = await fetchStories(username, engine, opts.sessionCookie);

  if (opts.dryRun) return { inserted: 0, checked: stories.length };

  // 만료된 스토리 삭제
  await supabase
    .from("instagram_stories")
    .delete()
    .eq("owner_type", owner.kind)
    .eq("owner_id", owner.id)
    .lt("expires_at", new Date().toISOString());

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

  return { inserted, checked: stories.length };
}
