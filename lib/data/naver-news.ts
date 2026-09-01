import "server-only";

import { unstable_cache } from "next/cache";
import { newsArticles as sampleNewsArticles, type NewsArticle, type NewsTone } from "@/lib/data/news";
import { attachStoredNewsThumbnails, materializeNewsThumbnail } from "@/lib/data/news-thumbnail-cache";
import { isSafePublicNewsUrl } from "@/lib/data/news-thumbnail";

const NAVER_NEWS_ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/news";
const DEFAULT_DISPLAY = 10;
const MAX_NAVER_START = 1000;
const MAX_PARALLEL_NAVER_PAGE_FETCHES = 4;
const NEWS_THUMBNAIL_RESOLVE_TTL_SECONDS = 60 * 60 * 6;

type NewsFeedSource = "naver" | "sample";

export type NewsFeed = {
  articles: NewsArticle[];
  source: NewsFeedSource;
  total: number;
  isFallback: boolean;
};

type NaverNewsItem = {
  title?: string;
  originallink?: string;
  link?: string;
  description?: string;
  pubDate?: string;
};

type NaverNewsResponse = {
  total?: number;
  items?: NaverNewsItem[];
};

type NormalizedNewsItem = {
  article: NewsArticle;
};

type NewsFeedOptions = {
  teamSlug?: string;
  query?: string;
  display?: number;
  start?: number;
};

type TeamNewsConfig = {
  query: string;
  aliases: string[];
  tone: NewsTone;
};

const TEAM_NEWS_CONFIG: Record<string, TeamNewsConfig> = {
  t1: { query: "LCK T1", aliases: ["T1", "티원"], tone: "red" },
  geng: { query: "LCK 젠지", aliases: ["Gen.G", "GenG", "젠지"], tone: "gold" },
  hle: { query: "LCK 한화생명", aliases: ["HLE", "Hanwha Life", "한화생명"], tone: "orange" },
  dk: { query: "LCK 디플러스 기아", aliases: ["DK", "Dplus KIA", "Dplus", "디플러스 기아", "디플러스"], tone: "blue" },
  kt: { query: "LCK KT 롤스터", aliases: ["KT", "KT Rolster", "KT 롤스터", "케이티 롤스터"], tone: "red" },
  drx: { query: "LCK DRX", aliases: ["DRX", "Kiwoom DRX", "키움 DRX", "키움 디알엑스"], tone: "blue" },
  ns: { query: "LCK 농심 레드포스", aliases: ["NS", "Nongshim RedForce", "농심 레드포스", "농심"], tone: "red" },
  bro: { query: "LCK 브리온", aliases: ["BRO", "BRION", "Hanjin BRION", "한진 브리온", "브리온"], tone: "gold" },
  fox: { query: "LCK BNK 피어엑스", aliases: ["FOX", "FearX", "BNK FearX", "BNK 피어엑스", "피어엑스"], tone: "orange" },
  soop: { query: "LCK DNS", aliases: ["DNS", "DN SOOPers", "DN 수퍼스", "SOOP", "DNF", "DN 프릭스", "광동 프릭스", "KDF"], tone: "blue" },
};

const SOURCE_NAMES: Array<[string, string]> = [
  ["lolesports.com", "LCK"],
  ["dailyesports.com", "데일리e스포츠"],
  ["inven.co.kr", "인벤"],
  ["fomos.kr", "포모스"],
  ["game.donga.com", "게임동아"],
  ["thisisgame.com", "디스이즈게임"],
  ["gamefocus.co.kr", "게임포커스"],
  ["gameple.co.kr", "게임플"],
  ["gamevu.co.kr", "게임뷰"],
  ["gamemeca.com", "게임메카"],
  ["gamechosun.co.kr", "게임조선"],
  ["osen.co.kr", "OSEN"],
  ["xportsnews.com", "엑스포츠뉴스"],
  ["sportsseoul.com", "스포츠서울"],
  ["mhnse.com", "MHN스포츠"],
  ["naver.com", "네이버 뉴스"],
];

const ESPORTS_EDITORIAL_DOMAINS = [
  "dailyesports.com",
  "inven.co.kr",
  "fomos.kr",
  "game.donga.com",
  "thisisgame.com",
  "gamefocus.co.kr",
  "gameple.co.kr",
  "gamevu.co.kr",
  "gamechosun.co.kr",
  "xportsnews.com",
  "sportsseoul.com",
  "osen.co.kr",
  "mhnse.com",
] as const;

const EXCLUDED_NEWS_DOMAINS = ["gamemeca.com"] as const;

function decodeNewsText(value = "") {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sourceFromUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    const knownSource = SOURCE_NAMES.find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`));
    return knownSource?.[1] ?? hostname.replace(/^m\./, "");
  } catch {
    return "뉴스";
  }
}

function isEsportsEditorialSource(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    if (EXCLUDED_NEWS_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      return false;
    }
    return ESPORTS_EDITORIAL_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function stableNewsId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `naver-${(hash >>> 0).toString(36)}`;
}

function containsAlias(text: string, alias: string) {
  if (/[가-힣]/.test(alias)) return text.includes(alias.toLocaleLowerCase("ko-KR"));
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function findTeamSlugs(text: string) {
  const normalized = text.toLocaleLowerCase("ko-KR");
  return Object.entries(TEAM_NEWS_CONFIG)
    .filter(([, config]) => config.aliases.some((alias) => containsAlias(normalized, alias)))
    .map(([slug]) => slug);
}

function inferCategory(text: string, teamSlugs: string[]): NewsArticle["category"] {
  if (/이적|영입|재계약|계약 종료|FA/.test(text)) return "이적";
  if (/선수|로스터|신인|데뷔|감독|코치/.test(text)) return "선수";
  if (/경기|매치|세트|승리|패배|결승|플레이오프|맞대결|꺾/.test(text)) return "경기";
  return teamSlugs.length > 0 ? "팀" : "LCK";
}

function normalizePublishedAt(value?: string) {
  if (!value) return new Date().toISOString();
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString();
}

function normalizeArticle(item: NaverNewsItem): NormalizedNewsItem | null {
  const url = [item.originallink, item.link].find((candidate): candidate is string => Boolean(candidate && isHttpUrl(candidate)));
  const title = decodeNewsText(item.title);
  if (!url || !title) return null;

  const summary = decodeNewsText(item.description);
  const searchableText = `${title} ${summary}`;
  const teamSlugs = findTeamSlugs(searchableText);
  const source = sourceFromUrl(url);

  return {
    article: {
      id: stableNewsId(url),
      title,
      source,
      url,
      publishedAt: normalizePublishedAt(item.pubDate),
      summary,
      category: inferCategory(searchableText, teamSlugs),
      teamSlugs,
      tone: TEAM_NEWS_CONFIG[teamSlugs[0]]?.tone ?? "league",
      isOfficial: source === "LCK",
    },
  };
}

function isRelevantLckItem(item: NormalizedNewsItem, requestedTeam?: string, hasCustomQuery = false) {
  const { title } = item.article;
  if (/^\[(식음료|유통(?:레이더)?|신상품|쇼핑)\]|여름 할인|추석 선물|체험관/.test(title)) return false;
  const titleTeams = findTeamSlugs(title);
  if (requestedTeam) return titleTeams.includes(requestedTeam);
  if (hasCustomQuery) return true;

  const hasLckInTitle = /\bLCK\b|LoL 챔피언스 코리아|리그 오브 레전드 챔피언스 코리아/i.test(title);
  return hasLckInTitle || titleTeams.length > 0;
}

function fallbackFeed({ teamSlug, query = "", display = DEFAULT_DISPLAY, start = 1 }: NewsFeedOptions): NewsFeed {
  const normalizedQuery = query.toLocaleLowerCase("ko-KR").trim();
  const filtered = (teamSlug
    ? sampleNewsArticles.filter((article) => article.teamSlugs.includes(teamSlug))
    : sampleNewsArticles)
    .filter((article) => !normalizedQuery || `${article.title} ${article.summary} ${article.source}`
      .toLocaleLowerCase("ko-KR")
      .includes(normalizedQuery));
  const articles = filtered.slice(start - 1, start - 1 + display);
  return { articles, source: "sample", total: filtered.length, isFallback: true };
}

type NormalizedNewsBatch = {
  normalizedItems: NormalizedNewsItem[];
  rawTotal: number;
  reachedRawEnd: boolean;
};

async function collectNormalizedItems(options: NewsFeedOptions): Promise<NormalizedNewsBatch | null> {
  const { teamSlug, query = "", display = DEFAULT_DISPLAY, start = 1 } = options;
  const clientId = process.env.NAVER_API_HUB_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const baseQuery = TEAM_NEWS_CONFIG[teamSlug ?? ""]?.query ?? "LCK";
  const searchQuery = [baseQuery, query.trim()].filter(Boolean).join(" ");
  const requestedDisplay = Math.min(Math.max(display, 1), 100);
  const requestedOffset = Math.max(start, 1) - 1;
  // 요청한 페이지를 채우고 "다음 페이지 유무"를 판단할 만큼만 모은다. 총 기사 수(totalPages)는
  // 네이버가 내려주는 rawTotal로 추정하므로, 관련 기사가 드물어도 1000건까지 전부 훑지 않는다.
  const requiredItemCount = requestedOffset + requestedDisplay + 1;
  const apiDisplay = 100;

  const seenUrls = new Set<string>();
  const normalizedItems: NormalizedNewsItem[] = [];
  let nextApiStart = 1;
  let batchSize = 1;
  let rawTotal = 0;
  let lastPageItemCount = apiDisplay;
  let reachedRawEnd = false;

  // 관련 기사가 드문 검색어는 최대 MAX_NAVER_START/apiDisplay(10)번의 조회가 필요할 수 있는데,
  // 순차 호출 대신 요청을 점점 늘려가며(1,2,4,4...) 병렬로 보내 왕복 지연을 줄인다.
  while (nextApiStart <= MAX_NAVER_START && normalizedItems.length < requiredItemCount && !reachedRawEnd) {
    const starts: number[] = [];
    for (let index = 0; index < batchSize && nextApiStart + index * apiDisplay <= MAX_NAVER_START; index += 1) {
      starts.push(nextApiStart + index * apiDisplay);
    }

    const pages = await Promise.all(starts.map(async (apiStart) => {
      const params = new URLSearchParams({
        query: searchQuery,
        display: String(apiDisplay),
        start: String(apiStart),
        sort: "date",
        format: "json",
      });
      const response = await fetch(`${NAVER_NEWS_ENDPOINT}?${params}`, {
        headers: {
          "X-NCP-APIGW-API-KEY-ID": clientId,
          "X-NCP-APIGW-API-KEY": clientSecret,
        },
        signal: AbortSignal.timeout(3000),
        next: { revalidate: 300 },
      }).catch(() => null);
      if (!response?.ok) return null;
      return response.json() as Promise<NaverNewsResponse>;
    }));

    for (const payload of pages) {
      if (!payload) return null;
      const items = payload.items ?? [];
      rawTotal = Math.max(rawTotal, payload.total ?? 0);
      lastPageItemCount = items.length;
      const batchItems = items
        .map((item) => normalizeArticle(item))
        .filter((item): item is NormalizedNewsItem => {
        if (
          !item
          || !isEsportsEditorialSource(item.article.url)
          || !isRelevantLckItem(item, teamSlug, Boolean(query.trim()))
          || seenUrls.has(item.article.url)
        ) return false;
        seenUrls.add(item.article.url);
        return true;
      });
      normalizedItems.push(...batchItems);

      if (items.length < apiDisplay) {
        reachedRawEnd = true;
        break;
      }
    }

    nextApiStart += starts.length * apiDisplay;
    batchSize = Math.min(batchSize * 2, MAX_PARALLEL_NAVER_PAGE_FETCHES);

    const rawResultLimit = Math.min(rawTotal || lastPageItemCount, MAX_NAVER_START);
    if (nextApiStart > rawResultLimit) reachedRawEnd = true;
  }

  return { normalizedItems, rawTotal, reachedRawEnd };
}

/**
 * 기사 원문 URL 하나를 불변 R2 썸네일 URL로 해석한다. 최초 한 번만 원문과 이미지를
 * 가져와 변환하고 이후 요청은 R2 객체를 재사용한다.
 */
export const resolveNewsThumbnail = unstable_cache(
  async (articleUrl: string): Promise<string | null> => {
    if (!isSafePublicNewsUrl(articleUrl)) return null;
    return materializeNewsThumbnail(articleUrl);
  },
  ["news-thumbnail-resolve"],
  { revalidate: NEWS_THUMBNAIL_RESOLVE_TTL_SECONDS },
);

async function getNewsFeedUncached(options: NewsFeedOptions = {}): Promise<NewsFeed> {
  const { display = DEFAULT_DISPLAY, start = 1 } = options;
  const requestedDisplay = Math.min(Math.max(display, 1), 100);
  const requestedOffset = Math.max(start, 1) - 1;

  try {
    const batch = await collectNormalizedItems(options);
    if (!batch) return fallbackFeed(options);
    const { normalizedItems, rawTotal, reachedRawEnd } = batch;

    const visibleItems = normalizedItems.slice(requestedOffset, requestedOffset + requestedDisplay);
    // R2 HEAD만 병렬 확인하고 이미 생성된 썸네일 URL을 즉시 응답에 포함한다.
    // 누락 항목의 원문 조회·변환은 응답 이후 warmup과 클라이언트 resolve가 담당한다.
    const articles = await attachStoredNewsThumbnails(visibleItems.map((item) => item.article));

    return {
      articles,
      source: "naver",
      total: reachedRawEnd ? normalizedItems.length : Math.max(rawTotal, normalizedItems.length),
      isFallback: false,
    };
  } catch {
    return fallbackFeed(options);
  }
}

/**
 * 팀/검색어/페이지 조합별 뉴스 피드. 네이버 검색 스캔과 원문 썸네일 스크래핑이 요청 경로에
 * 얹히므로, 조합을 키로 결과를 캐시해 revalidate 주기 안에서는 외부 호출을 건너뛴다.
 * (fallbackFeed로 떨어진 결과도 잠깐 캐시되지만 revalidate가 짧아 곧 복구된다.)
 */
export const getNewsFeed = unstable_cache(
  getNewsFeedUncached,
  ["news-feed"],
  { revalidate: 180 },
);

function selectDiverseArticles<T>(
  items: T[],
  limit: number,
  getArticle: (item: T) => Pick<NewsArticle, "teamSlugs" | "publishedAt" | "id">,
): T[] {
  const sorted = [...items].sort(
    (a, b) => new Date(getArticle(b).publishedAt).getTime() - new Date(getArticle(a).publishedAt).getTime(),
  );
  const picked: T[] = [];
  const representedTeams = new Set<string>();

  for (const item of sorted) {
    const { teamSlugs } = getArticle(item);
    const introducesTeam = teamSlugs.some((slug) => !representedTeams.has(slug));
    if (picked.length > 0 && teamSlugs.length > 0 && !introducesTeam) continue;
    picked.push(item);
    teamSlugs.forEach((slug) => representedTeams.add(slug));
    if (picked.length === limit) return picked;
  }

  for (const item of sorted) {
    if (!picked.some((pickedItem) => getArticle(pickedItem).id === getArticle(item).id)) picked.push(item);
    if (picked.length === limit) break;
  }
  return picked;
}

function pickHomeArticles(articles: NewsArticle[], limit: number) {
  return selectDiverseArticles(articles, limit, (article) => article);
}

async function getHomeNewsFeedUncached(limit = 4): Promise<NewsFeed> {
  const candidateDisplay = Math.max(limit * 2, 8);

  try {
    const batch = await collectNormalizedItems({ display: candidateDisplay });
    if (!batch) {
      const fallback = fallbackFeed({ display: candidateDisplay });
      return { ...fallback, articles: pickHomeArticles(fallback.articles, limit) };
    }

    // 후보군 중 실제 노출 기사만 고르고, 이미 R2에 만들어진 URL만 빠르게 붙인다.
    const picked = selectDiverseArticles(batch.normalizedItems, limit, (item) => item.article);
    const articles = await attachStoredNewsThumbnails(picked.map((item) => item.article));

    return {
      articles,
      source: "naver",
      total: batch.reachedRawEnd ? batch.normalizedItems.length : Math.max(batch.rawTotal, batch.normalizedItems.length),
      isFallback: false,
    };
  } catch {
    const fallback = fallbackFeed({ display: candidateDisplay });
    return { ...fallback, articles: pickHomeArticles(fallback.articles, limit) };
  }
}

/**
 * 홈 화면 뉴스 피드. 요청 경로에서는 R2 존재 여부만 확인하고 원문 스크래핑과 변환은
 * 응답 이후 워밍으로 넘긴다. LCK 채널 영상과 같은 이유로 짧게 캐시한다.
 */
export const getHomeNewsFeed = unstable_cache(
  getHomeNewsFeedUncached,
  ["home-news-feed"],
  { revalidate: 180 },
);
