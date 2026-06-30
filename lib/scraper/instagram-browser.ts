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
  maxPosts = 500,
): Promise<NormalizedPost[]> {
  const context = await createContext(sessionCookie);

  try {
    const page = await context.newPage();

    const postsMap = new Map<string, NormalizedPost>();
    // 초기 응답에서 커서와 userId 추출
    let userId = "";
    let endCursor = "";
    let hasNextPage = false;

    page.on("response", async (res) => {
      try {
        const url = res.url();
        const ct = res.headers()["content-type"] ?? "";
        if (!ct.includes("json") && !ct.includes("javascript")) return;
        if (
          !url.includes("/graphql/") &&
          !url.includes("/graphql") &&
          !url.includes("web_profile_info")
        ) return;

        const json = await res.json().catch(() => null);
        if (!json || typeof json !== "object") return;

        // web_profile_info 형식
        const userData = json?.data?.user ?? json?.graphql?.user;
        if (userData) {
          if (userData.id) userId = String(userData.id);
          const pageInfo = userData.edge_owner_to_timeline_media?.page_info;
          if (pageInfo) {
            hasNextPage = pageInfo.has_next_page ?? false;
            endCursor = pageInfo.end_cursor ?? "";
          }
        }

        // 새 GraphQL 형식 (graphql/query?doc_id=...)
        const xdt = json?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;
        if (xdt) {
          if (xdt.page_info) {
            hasNextPage = xdt.page_info.has_next_page ?? false;
            endCursor = xdt.page_info.end_cursor ?? "";
          }
          // xdt 형식에서 userId 추출 (첫 번째 노드의 owner.id)
          if (!userId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ownerNode = (xdt.edges as any[])?.[0]?.node;
            const ownerId = ownerNode?.owner?.id ?? ownerNode?.user?.pk;
            if (ownerId) userId = String(ownerId);
          }
        }


        const parsed = parseProfilePosts(json);
        if (parsed.length > 0) {
          const before = postsMap.size;
          for (const p of parsed) postsMap.set(p.postId, p);
          const added = postsMap.size - before;
          if (added > 0) {
            console.log(`  [capture] ${url.slice(0, 80)} → +${added} posts (total: ${postsMap.size})`);
          }
        }
      } catch { /* ignore */ }
    });

    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "networkidle",
      timeout: 40_000,
    });
    await page.waitForTimeout(3_000);

    // 로그인 상태 확인
    const title = await page.title();
    if (title.toLowerCase().includes("login") || title.includes("로그인")) {
      console.log(`  [warn] Instagram 비로그인 상태 — 세션 쿠키가 만료되었거나 차단됨 (title: "${title}")`);
    }

    // userId를 페이지 JS 상태에서 추출 (web_profile_info가 막혀도 동작)
    if (!userId) {
      userId = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        return (
          w?.__additionalDataLoaded?.["feed"]?.user?.id ??
          w?._sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user?.id ??
          ""
        );
      }).catch(() => "");
      if (userId) console.log(`  [userId] extracted from page JS: ${userId}`);
    }

    console.log(`  [pagination-start] posts=${postsMap.size} userId=${userId || "(none)"} hasNextPage=${hasNextPage} cursor=${endCursor?.slice(0, 20) || "(none)"}`);

    // 페이지네이션: page.evaluate 안에서 fetch → 브라우저 쿠키·헤더 전부 자동 포함
    while (postsMap.size < maxPosts && hasNextPage && userId && endCursor) {
      const cursor = endCursor;
      hasNextPage = false;

      console.log(`  [paginate] cursor=${cursor.slice(0, 20)}...`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await page.evaluate(async ({ uid, cur }) => {
        try {
          const res = await fetch(
            `https://www.instagram.com/api/v1/feed/user/${uid}/?count=12&max_id=${encodeURIComponent(cur)}`,
            { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest", "X-IG-App-ID": "936619743392459" } },
          );
          return res.json();
        } catch {
          return null;
        }
      }, { uid: userId, cur: cursor }).catch(() => null);

      if (!json) break;

      if (json.require_login || json.status === "fail") {
        console.log(`  [paginate] session error: ${json.message ?? json.status}`);
        break;
      }

      hasNextPage = json.more_available ?? false;
      endCursor = json.next_max_id ?? "";

      const parsed = parseProfilePosts(json);
      const before = postsMap.size;
      for (const p of parsed) postsMap.set(p.postId, p);
      console.log(`  [paginate] +${postsMap.size - before} posts (total: ${postsMap.size}), more: ${hasNextPage}`);

      await page.waitForTimeout(800);
    }

    return Array.from(postsMap.values()).sort(
      (a, b) => b.postedAt.getTime() - a.postedAt.getTime(),
    );
  } finally {
    await context.close();
  }
}

// ─── 공개 API: embed 이미지 복구 ─────────────────────────────────
//
// 만료된 CDN URL을 든 옛 게시물은 프로필 스크랩 창에 안 잡혀 복구가 안 된다.
// 하지만 embed 페이지(/p/{shortcode}/embed/)는 shortcode만 있으면 게시물
// 나이와 무관하게 인스타가 클라이언트에서 메인 이미지를 렌더해 준다.
// 실제 브라우저로 렌더한 뒤 그 신선한 URL을 뽑아낸다. (로그인 불필요)

export interface EmbedImageScraper {
  fetch: (shortcode: string) => Promise<string | null>;
  close: () => Promise<void>;
}

/**
 * embed 페이지를 재사용 가능한 단일 페이지로 렌더해 게시물의 신선한
 * 메인 이미지 URL을 뽑는 스크래퍼를 만든다. 많은 shortcode를 처리할 때
 * 컨텍스트를 한 번만 띄우고 페이지만 갈아끼우므로 효율적이다.
 */
export async function createEmbedImageScraper(
  sessionCookie?: string,
): Promise<EmbedImageScraper> {
  const context = await createContext(sessionCookie);
  const page = await context.newPage();

  // embed는 부하 시 일시적으로 500/빈 페이지를 주므로(삭제 아님) 재시도한다.
  async function attempt(shortcode: string): Promise<string | null> {
    try {
      await page.goto(
        `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
        { waitUntil: "networkidle", timeout: 40_000 },
      );
      // 메인 이미지가 로드될 때까지 잠깐 대기 (삭제·비공개면 안 뜸)
      await page
        .waitForSelector("img.EmbeddedMediaImage", { timeout: 8_000 })
        .catch(() => null);

      return await page.evaluate(() => {
          // 피드 미디어는 사진 `t51.{...}-15`, 영상 썸네일도 `t51.{...}-15`
          // (예: 사진 t51.82787-15, 영상 t51.71878-15). 프로필 아바타만 `-19`.
          const isAvatar = (s: string) => /\/t51\.\d+-19\//.test(s);
          const isFeed = (s: string) => /\/t51\.\d+-15\//.test(s);

          // 1순위: 메인 미디어 이미지 (사진·영상 썸네일 모두 여기 잡힘)
          const main = document.querySelector<HTMLImageElement>(
            "img.EmbeddedMediaImage",
          );
          const mainSrc = main?.currentSrc || main?.src;
          if (mainSrc && mainSrc.includes("cdninstagram") && !isAvatar(mainSrc)) {
            return mainSrc;
          }

          // 2순위: 피드 이미지 중 가장 큰 것
          // — 아바타(-19)와 하단 "더 보기" 썸네일(150px)은 제외
          const imgs = Array.from(document.querySelectorAll("img"))
            .map((e) => ({ src: e.currentSrc || e.src, w: e.naturalWidth }))
            .filter((x) => x.src && isFeed(x.src) && !isAvatar(x.src) && x.w >= 320)
            .sort((a, b) => b.w - a.w);
          return imgs[0]?.src ?? null;
        });
      } catch {
        return null;
      }
    }

  return {
    async fetch(shortcode: string): Promise<string | null> {
      // 최대 3회: 일시적 500/throttle은 backoff 후 재시도하면 대부분 회복된다.
      for (let i = 0; i < 3; i++) {
        const url = await attempt(shortcode);
        if (url) return url;
        if (i < 2) await page.waitForTimeout(1_500 * (i + 1));
      }
      return null;
    },
    async close() {
      await context.close();
    },
  };
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
