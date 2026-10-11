import type { NormalizedPost } from "../sync/instagram.ts";

// Business Discovery + media verified on 2026-10-12. Expand only after a successful audit.
export const INSTAGRAM_GRAPH_USERNAMES = new Set([
  "lol_lehends", "chovy_jihun", "lol_ruler98", "lol_delight", "gumayusi",
  "woojechoii", "lazyfeel1903", "clozer_2003", "lol_willer", "dong_gyu_pollu",
  "gh5st", "choi_doran", "keria_minseok", "t1_oner", "lol_peyz",
  "bnk_fearx", "dpluskia.lol", "gengesports", "soopers_lol", "drxglobal",
  "ktrolstagram", "t1lol", "brionesports", "hle.official", "ns_redforce",
]);

interface GraphMedia {
  id: string;
  permalink: string;
  timestamp: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  like_count?: number;
  comments_count?: number;
  children?: { data: GraphMedia[] };
}

export function instagramGraphCredentials() {
  const token = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN?.trim();
  const userId = process.env.INSTAGRAM_GRAPH_USER_ID?.trim();
  if (!token || !userId || !/^\d+$/.test(userId)) {
    throw new Error("INSTAGRAM_GRAPH_CONFIG: official API token/user ID required; cookie fallback is disabled.");
  }
  return { token, userId };
}

export function normalizeGraphMedia(media: GraphMedia): NormalizedPost {
  const url = new URL(media.permalink);
  const shortcode = url.pathname.match(/^\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/)?.[1];
  const postedAt = new Date(media.timestamp);
  if (!shortcode || !["www.instagram.com", "instagram.com"].includes(url.hostname) || Number.isNaN(postedAt.getTime())) {
    throw new Error("INSTAGRAM_GRAPH_DATA: invalid media permalink or timestamp.");
  }
  const preview = media.media_type === "CAROUSEL_ALBUM" ? media.children?.data[0] ?? media : media;
  return {
    postId: media.id,
    shortcode,
    // Browser collection historically used /p/ for reels too. Keep that deduplication key.
    sourceUrl: `https://www.instagram.com/p/${shortcode}/`,
    imageUrl: preview.media_type === "VIDEO" ? preview.thumbnail_url ?? "" : preview.media_url ?? "",
    caption: media.caption ?? "",
    postedAt,
    likesCount: media.like_count ?? 0,
    commentsCount: media.comments_count ?? 0,
  };
}

export async function fetchInstagramGraphPosts(username: string, maxPosts = 60): Promise<NormalizedPost[]> {
  if (!INSTAGRAM_GRAPH_USERNAMES.has(username.toLowerCase())) {
    throw new Error(`INSTAGRAM_GRAPH_UNSUPPORTED: @${username} is not in the verified collection list.`);
  }
  if (!Number.isInteger(maxPosts) || maxPosts < 1 || maxPosts > 500) throw new Error("Invalid maxPosts.");
  const { token, userId } = instagramGraphCredentials();
  const posts = new Map<string, NormalizedPost>();
  const cursors = new Set<string>();
  let after: string | undefined;
  do {
    const count = Math.min(50, maxPosts - posts.size);
    const cursor = after ? `.after(${after})` : "";
    const fields = `business_discovery.username(${username}){id,media.limit(${count})${cursor}{id,permalink,timestamp,caption,media_type,media_url,thumbnail_url,like_count,comments_count,children{media_type,media_url,thumbnail_url}}}`;
    const url = new URL(`https://graph.facebook.com/v26.0/${userId}`);
    url.searchParams.set("fields", fields);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    const body = await response.json() as {
      error?: { code?: number; error_subcode?: number };
      business_discovery?: { id?: string; media?: { data?: GraphMedia[]; paging?: { next?: string; cursors?: { after?: string } } } };
    };
    if (!response.ok || body.error) {
      const code = body.error?.code;
      const fatal = response.status === 401 || response.status === 403 || response.status === 429 || [4, 10, 17, 32, 190, 200, 613].includes(code ?? 0);
      // Never log the raw response/request: pagination URLs may contain credentials.
      throw new Error(`INSTAGRAM_GRAPH_${fatal ? "STOP" : "ERROR"}: @${username} HTTP=${response.status} code=${code ?? "unknown"} subcode=${body.error?.error_subcode ?? "none"}`);
    }
    if (!body.business_discovery?.id || !Array.isArray(body.business_discovery.media?.data)) {
      throw new Error(`INSTAGRAM_GRAPH_DATA: @${username} missing discovery/media response.`);
    }
    const media = body.business_discovery.media;
    for (const item of media.data!) {
      const post = normalizeGraphMedia(item);
      posts.set(post.sourceUrl, post);
    }
    // Nested Business Discovery media can expose cursors without a next URL.
    const nextCursor = media.paging?.cursors?.after;
    if (!nextCursor || media.data!.length < count || posts.size >= maxPosts) break;
    if (!/^[A-Za-z0-9_=-]+$/.test(nextCursor) || cursors.has(nextCursor)) throw new Error("INSTAGRAM_GRAPH_DATA: invalid/repeated pagination cursor.");
    cursors.add(nextCursor);
    after = nextCursor;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } while (after);
  return [...posts.values()].slice(0, maxPosts);
}
