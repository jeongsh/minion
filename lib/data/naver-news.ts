import "server-only";

import { newsArticles as sampleNewsArticles, type NewsArticle, type NewsTone } from "@/lib/data/news";
import { isSafePublicNewsUrl, newsThumbnailProxyUrl } from "@/lib/data/news-thumbnail";

const NAVER_NEWS_ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/news";
const DEFAULT_DISPLAY = 10;
const MAX_NAVER_START = 1000;
const ARTICLE_METADATA_TTL_SECONDS = 60 * 60 * 6;

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
  thumbnailCandidates: string[];
};

type NewsFeedOptions = {
  teamSlug?: string;
  query?: string;
  display?: number;
  start?: number;
  scanLimit?: number;
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

function metaAttribute(tag: string, attribute: string) {
  const quoted = tag.match(new RegExp(`${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  if (quoted?.[2]) return quoted[2];
  return tag.match(new RegExp(`${attribute}\\s*=\\s*([^\\s>]+)`, "i"))?.[1] ?? "";
}

function findMetadataImage(html: string, pageUrl: string) {
  const acceptedKeys = new Set(["og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
  for (const tag of html.match(/<meta\s[^>]*>/gi) ?? []) {
    const key = (metaAttribute(tag, "property") || metaAttribute(tag, "name")).toLowerCase();
    if (!acceptedKeys.has(key)) continue;
    const content = decodeNewsText(metaAttribute(tag, "content"));
    if (!content) continue;

    try {
      const imageUrl = new URL(content, pageUrl).toString();
      if (isSafePublicNewsUrl(imageUrl)) return imageUrl;
    } catch {
      continue;
    }
  }
  return undefined;
}

async function fetchArticleHtml(value: string, redirects = 0): Promise<{ html: string; url: string } | null> {
  if (!isSafePublicNewsUrl(value) || redirects > 3) return null;

  const response = await fetch(value, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; MINION-News/1.0)",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(4500),
    next: { revalidate: ARTICLE_METADATA_TTL_SECONDS },
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) return null;
    return fetchArticleHtml(new URL(location, value).toString(), redirects + 1);
  }

  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return null;
  return { html: (await response.text()).slice(0, 750_000), url: response.url || value };
}

async function findArticleThumbnail(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      const page = await fetchArticleHtml(candidate);
      if (!page) continue;
      const imageUrl = findMetadataImage(page.html, page.url);
      if (imageUrl) return imageUrl;
    } catch {
      continue;
    }
  }
  return undefined;
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
    thumbnailCandidates: [item.originallink, item.link]
      .filter((candidate): candidate is string => Boolean(candidate && isSafePublicNewsUrl(candidate))),
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

export async function getNewsFeed(options: NewsFeedOptions = {}): Promise<NewsFeed> {
  const { teamSlug, query = "", display = DEFAULT_DISPLAY, start = 1, scanLimit = 0 } = options;
  const clientId = process.env.NAVER_API_HUB_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return fallbackFeed(options);

  const baseQuery = TEAM_NEWS_CONFIG[teamSlug ?? ""]?.query ?? "LCK";
  const searchQuery = [baseQuery, query.trim()].filter(Boolean).join(" ");
  const requestedDisplay = Math.min(Math.max(display, 1), 100);
  const requestedOffset = Math.max(start, 1) - 1;
  const requiredItemCount = Math.max(
    requestedOffset + requestedDisplay + 1,
    Math.max(scanLimit, 0) + 1,
  );
  const apiDisplay = 100;

  try {
    const seenUrls = new Set<string>();
    const normalizedItems: NormalizedNewsItem[] = [];
    let apiStart = 1;
    let rawTotal = 0;
    let reachedRawEnd = false;

    while (apiStart <= MAX_NAVER_START && normalizedItems.length < requiredItemCount) {
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
        next: { revalidate: 300 },
      });
      if (!response.ok) return fallbackFeed(options);

      const payload = await response.json() as NaverNewsResponse;
      const items = payload.items ?? [];
      rawTotal = Math.max(rawTotal, payload.total ?? 0);
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

      const rawResultLimit = Math.min(rawTotal || items.length, MAX_NAVER_START);
      apiStart += apiDisplay;
      reachedRawEnd = items.length < apiDisplay || apiStart > rawResultLimit;
      if (reachedRawEnd) break;
    }

    const visibleItems = normalizedItems.slice(requestedOffset, requestedOffset + requestedDisplay);
    const articles = await Promise.all(visibleItems.map(async ({ article, thumbnailCandidates }) => ({
      ...article,
      thumbnailUrl: newsThumbnailProxyUrl(await findArticleThumbnail(thumbnailCandidates) ?? ""),
    })));

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

function pickHomeArticles(articles: NewsArticle[], limit: number) {
  const sorted = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const picked: NewsArticle[] = [];
  const representedTeams = new Set<string>();

  for (const article of sorted) {
    const introducesTeam = article.teamSlugs.some((slug) => !representedTeams.has(slug));
    if (picked.length > 0 && article.teamSlugs.length > 0 && !introducesTeam) continue;
    picked.push(article);
    article.teamSlugs.forEach((slug) => representedTeams.add(slug));
    if (picked.length === limit) return picked;
  }

  for (const article of sorted) {
    if (!picked.some((pickedArticle) => pickedArticle.id === article.id)) picked.push(article);
    if (picked.length === limit) break;
  }
  return picked;
}

export async function getHomeNewsFeed(limit = 4): Promise<NewsFeed> {
  const feed = await getNewsFeed({ display: Math.max(limit * 2, 8) });
  const articles = pickHomeArticles(feed.articles, limit);
  return { ...feed, articles };
}
