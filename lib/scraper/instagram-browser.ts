/**
 * Playwright 기반 Instagram 스크래퍼
 *
 * 실제 Chromium 브라우저로 Instagram 페이지를 탐색하여
 * 내부 API 응답을 가로채는 방식으로 게시물·스토리를 수집합니다.
 */

import { chromium, type Browser } from "playwright";

import type { NormalizedPost, NormalizedStory } from "../sync/instagram.ts";

// ─── 브라우저 싱글턴 ────────────────────────────────────────────

let _browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
    });
  }
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

// ─── 쿠키 파싱 ──────────────────────────────────────────────────

function parseCookieString(cookieStr: string) {
  return cookieStr
    .split(";")
    .map((pair) => {
      const idx = pair.indexOf("=");
      if (idx === -1) return null;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      return name ? { name, value } : null;
    })
    .filter((c): c is { name: string; value: string } => c !== null);
}

// ─── 응답 파싱: 게시물 ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseProfilePosts(data: any): NormalizedPost[] {
  // web_profile_info 형식
  const edges =
    data?.data?.user?.edge_owner_to_timeline_media?.edges ??
    data?.graphql?.user?.edge_owner_to_timeline_media?.edges ??
    [];

  if (edges.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (edges as any[])
      .map((edge) => {
        const node = edge?.node;
        if (!node?.shortcode) return null;
        const captionText: string =
          node.edge_media_to_caption?.edges?.[0]?.node?.text ?? "";
        const imageUrl: string = node.display_url ?? node.thumbnail_src ?? "";
        return {
          postId: String(node.id ?? node.shortcode),
          shortcode: node.shortcode as string,
          imageUrl,
          caption: captionText,
          postedAt: node.taken_at_timestamp
            ? new Date((node.taken_at_timestamp as number) * 1000)
            : new Date(0),
          likesCount: (node.edge_liked_by?.count ?? 0) as number,
          commentsCount: (node.edge_media_to_comment?.count ?? 0) as number,
          sourceUrl: `https://www.instagram.com/p/${node.shortcode}/`,
        } satisfies NormalizedPost;
      })
      .filter((p): p is NormalizedPost => p !== null);
  }

  // 새 GraphQL 응답 형식 (items 배열)
  const items =
    data?.data?.xdt_api__v1__feed__user_timeline_graphql_connection?.edges ??
    data?.items ??
    [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (items as any[])
    .map((item) => {
      const node = item?.node ?? item;
      if (!node?.pk && !node?.code) return null;
      const shortcode: string = node.code ?? node.shortcode ?? String(node.pk ?? "");
      const captionText: string = node.caption?.text ?? "";
      const candidates = node.image_versions2?.candidates ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageUrl: string =
        ([...candidates] as any[]).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? "";
      return {
        postId: String(node.pk ?? shortcode),
        shortcode,
        imageUrl,
        caption: captionText,
        postedAt: node.taken_at
          ? new Date((node.taken_at as number) * 1000)
          : new Date(0),
        likesCount: (node.like_count ?? 0) as number,
        commentsCount: (node.comment_count ?? 0) as number,
        sourceUrl: `https://www.instagram.com/p/${shortcode}/`,
      } satisfies NormalizedPost;
    })
    .filter((p): p is NormalizedPost => p !== null);
}

// ─── 응답 파싱: 스토리 ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseStories(data: any): NormalizedStory[] {
  const items =
    data?.data?.reels_media?.[0]?.items ??
    data?.reels_media?.[0]?.items ??
    data?.data?.reels?.items ??
    data?.data?.items ??
    data?.items ??
    [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (items as any[])
    .map((item) => {
      if (!item?.pk) return null;
      const isVideo = item.media_type === 2;
      const candidates = item.image_versions2?.candidates ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bestImage: string =
        ([...candidates] as any[]).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? "";
      const mediaUrl: string = isVideo ? (item.video_url ?? bestImage) : bestImage;
      if (!mediaUrl) return null;

      const takenAt = new Date((item.taken_at as number) * 1000);
      const expiresAt = item.expiring_at
        ? new Date((item.expiring_at as number) * 1000)
        : new Date(takenAt.getTime() + 24 * 60 * 60 * 1000);

      const story: NormalizedStory = {
        storyPk: String(item.pk),
        mediaUrl,
        mediaType: isVideo ? "video" : "image",
        takenAt,
        expiresAt,
      };
      if (isVideo && bestImage) story.thumbnailUrl = bestImage;
      return story;
    })
    .filter((s): s is NormalizedStory => s !== null);
}

// ─── 공통: 새 브라우저 컨텍스트 생성 ────────────────────────────

async function createContext(sessionCookie?: string) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    locale: "ko-KR",
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: {
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  // 자동화 감지 우회
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).chrome = { runtime: {} };
  });

  if (sessionCookie) {
    await context.addCookies(
      parseCookieString(sessionCookie).map((c) => ({
        ...c,
        domain: ".instagram.com",
        path: "/",
        secure: true,
        sameSite: "None" as const,
      })),
    );
  }

  return context;
}

// ─── 공개 API: 게시물 ────────────────────────────────────────────

export async function scrapeInstagramPosts(
  username: string,
  sessionCookie?: string,
): Promise<NormalizedPost[]> {
  const context = await createContext(sessionCookie);

  try {
    const page = await context.newPage();

    // 수집된 게시물 담을 배열
    let posts: NormalizedPost[] = [];

    // Instagram GraphQL 응답은 text/javascript 또는 application/json 모두 가능
    page.on("response", async (res) => {
      try {
        const url = res.url();
        const ct = res.headers()["content-type"] ?? "";
        const isRelevantType = ct.includes("json") || ct.includes("javascript");
        if (!isRelevantType) return;

        // 포스트 데이터는 /graphql/query 또는 /api/graphql에서 옴
        // POST body에 username이 있으므로 URL로 username 구별 불가
        const isApiEndpoint =
          url.includes("/graphql/") ||
          url.includes("/graphql") ||
          url.includes("web_profile_info");
        if (!isApiEndpoint) return;

        const json = await res.json().catch(() => null);
        if (!json || typeof json !== "object") return;

        const parsed = parseProfilePosts(json);
        if (parsed.length > posts.length) {
          posts = parsed;
          console.log(`  [capture] ${url.slice(0, 80)} → ${parsed.length} posts`);
        }
      } catch { /* ignore */ }
    });

    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "networkidle",
      timeout: 40_000,
    });

    // networkidle 이후 추가 대기
    await page.waitForTimeout(3_000);

    return posts;
  } finally {
    await context.close();
  }
}

// ─── 공개 API: 스토리 ────────────────────────────────────────────

export async function scrapeInstagramStories(
  username: string,
  sessionCookie?: string,
): Promise<NormalizedStory[]> {
  if (!sessionCookie) return [];

  const context = await createContext(sessionCookie);

  try {
    const page = await context.newPage();
    let stories: NormalizedStory[] = [];

    page.on("response", async (res) => {
      try {
        const url = res.url();
        const ct = res.headers()["content-type"] ?? "";
        const isRelevantType = ct.includes("json") || ct.includes("javascript");
        if (!isRelevantType) return;

        // 스토리는 graphql 또는 reels/stories 관련 엔드포인트에서 옴
        const isStoryEndpoint =
          url.includes("reels_media") ||
          url.includes("/story/") ||
          url.includes("stories") ||
          url.includes("reel/feed") ||
          url.includes("/graphql/") ||
          url.includes("/graphql");
        if (!isStoryEndpoint) return;

        const json = await res.json().catch(() => null);
        if (!json) return;

        const parsed = parseStories(json);
        if (parsed.length > stories.length) {
          stories = parsed;
          console.log(`  [capture] ${url.slice(0, 80)} → ${parsed.length} stories`);
        }
      } catch { /* ignore */ }
    });

    await page.goto(`https://www.instagram.com/stories/${username}/`, {
      waitUntil: "networkidle",
      timeout: 40_000,
    });

    await page.waitForTimeout(3_000);

    return stories;
  } finally {
    await context.close();
  }
}
