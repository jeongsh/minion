import type { InstagramRun } from "../sync/instagram-control.ts";
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

export function safeInstagramMessage(value: unknown): string {
  let text = String(value ?? "");
  const token = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN?.trim();
  if (token) text = text.split(token).join("[REDACTED]");
  return text.replace(/https?:\/\/\S+/g, "[URL]").replace(/(?:EAA|IGAA)[A-Za-z0-9_-]+/g, "[REDACTED]").replace(/[\r\n]/g, " ").slice(0, 500);
}

export async function* fetchInstagramGraphPages(username: string, maxPosts: number, run: InstagramRun): AsyncGenerator<NormalizedPost[]> {
  if (!INSTAGRAM_GRAPH_USERNAMES.has(username.toLowerCase())) throw new Error(`INSTAGRAM_GRAPH_UNSUPPORTED: @${username}`);
  if (!Number.isInteger(maxPosts) || maxPosts < 1 || maxPosts > 60) throw new Error("Invalid maxPosts (1-60).");
  const { token, userId } = instagramGraphCredentials();
  const seen = new Set<string>();
  const cursors = new Set<string>();
  let after: string | undefined;
  let requests = 0;
  do {
    run.beforeRequest();
    if (requests >= Math.ceil(maxPosts / 20)) {
      await run.fail("transient");
      throw new Error("INSTAGRAM_GRAPH_STOP: page request budget exhausted");
    }
    const count = Math.min(20, maxPosts - seen.size);
    const cursor = after ? `.after(${after})` : "";
    const fields = `business_discovery.username(${username}){id,media.limit(${count})${cursor}{id,permalink,timestamp,caption,media_type,media_url,thumbnail_url,children.limit(1){media_type,media_url,thumbnail_url}}}`;
    const url = new URL(`https://graph.facebook.com/v26.0/${userId}`);
    url.searchParams.set("fields", fields);
    const started = Date.now();
    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(30_000) });
    } catch {
      await run.fail("transient");
      throw new Error(`INSTAGRAM_GRAPH_STOP: @${username} network/timeout; no retry`);
    }
    requests++;
    const body = await response.json().catch(() => null) as {
      error?: { code?: number; error_subcode?: number; message?: string; is_transient?: boolean; fbtrace_id?: string };
      business_discovery?: { id?: string; media?: { data?: GraphMedia[]; paging?: { cursors?: { after?: string } } } };
    } | null;
    const usage: Record<string, number> = {};
    for (const header of ["x-app-usage", "x-page-usage", "x-business-use-case-usage"]) {
      const collect = (value: unknown) => {
        if (!value || typeof value !== "object") return;
        for (const [key, item] of Object.entries(value)) {
          if (["call_count", "total_cputime", "total_time", "estimated_time_to_regain_access"].includes(key) && typeof item === "number") usage[key] = Math.max(usage[key] ?? 0, item);
          else if (item && typeof item === "object") collect(item);
        }
      };
      try { collect(JSON.parse(response.headers.get(header) ?? "null")); } catch { /* optional diagnostics */ }
    }
    console.log(`[graph-request] @${username} page=${requests} HTTP=${response.status} elapsed_ms=${Date.now() - started} usage=${JSON.stringify(usage)}`);
    const retryHeader = response.headers.get("retry-after");
    const retryMs = retryHeader ? (/^\d+$/.test(retryHeader) ? Number(retryHeader) * 1000 : Math.max(0, Date.parse(retryHeader) - Date.now()) || 0) : 0;
    const code = body?.error?.code;
    const rate = response.status === 429 || [4, 17, 32, 613, 80004].includes(code ?? 0)
      || [usage.call_count, usage.total_cputime, usage.total_time].some(n => n >= 80) || (usage.estimated_time_to_regain_access ?? 0) > 0 || retryMs > 0;
    const auth = response.status === 401 || response.status === 403 || [10, 190, 200].includes(code ?? 0);
    if (rate || auth || !response.ok || body?.error || !body?.business_discovery?.id || !Array.isArray(body.business_discovery.media?.data)) {
      await run.fail(auth ? "auth" : rate ? "rate" : "transient", Math.max(retryMs, (usage.estimated_time_to_regain_access ?? 0) * 60_000));
      throw new Error(`INSTAGRAM_GRAPH_STOP: @${username} HTTP=${response.status} code=${code ?? "unknown"} subcode=${body?.error?.error_subcode ?? "none"} transient=${body?.error?.is_transient ?? "unknown"} trace=${safeInstagramMessage(body?.error?.fbtrace_id)} message=${safeInstagramMessage(body?.error?.message)}; no retry`);
    }
    const media = body.business_discovery.media;
    const page = media.data!.map(normalizeGraphMedia).filter(post => !seen.has(post.sourceUrl));
    for (const post of page) seen.add(post.sourceUrl);
    yield page;
    const next = media.paging?.cursors?.after;
    if (!next || media.data!.length < count || seen.size >= maxPosts) break;
    if (!page.length || !/^[A-Za-z0-9_=-]+$/.test(next) || cursors.has(next)) {
      await run.fail("transient");
      throw new Error("INSTAGRAM_GRAPH_STOP: invalid/repeated pagination cursor");
    }
    cursors.add(next);
    after = next;
    await new Promise(resolve => setTimeout(resolve, 1500));
  } while (after);
}

export async function fetchInstagramGraphPosts(username: string, maxPosts: number, run: InstagramRun): Promise<NormalizedPost[]> {
  const posts: NormalizedPost[] = [];
  for await (const page of fetchInstagramGraphPages(username, maxPosts, run)) posts.push(...page);
  return posts;
}
