import "server-only";

import { createHash } from "node:crypto";
import type { NewsArticle } from "@/lib/data/news";
import { isSafePublicNewsUrl, newsThumbnailProxyUrl } from "@/lib/data/news-thumbnail";
import { resizeImageForWeb } from "@/lib/images/resize-for-web";
import {
  isR2Configured,
  isR2Url,
  r2ObjectExists,
  r2PublicUrl,
  uploadToR2,
} from "@/lib/storage/r2";

const ARTICLE_METADATA_TTL_SECONDS = 60 * 60 * 6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const NEWS_THUMBNAIL_CACHE_CONTROL = "public, max-age=31536000, immutable";
const inFlightMaterializations = new Map<string, Promise<string | null>>();

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
  return null;
}

async function fetchArticleHtml(value: string, redirects = 0): Promise<{ html: string; url: string } | null> {
  if (!isSafePublicNewsUrl(value) || redirects > 3) return null;

  const response = await fetch(value, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; MINION-News/1.0)",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(2500),
    next: { revalidate: ARTICLE_METADATA_TTL_SECONDS },
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) return null;
    return fetchArticleHtml(new URL(location, value).toString(), redirects + 1);
  }

  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return null;
  return { html: (await response.text()).slice(0, 200_000), url: response.url || value };
}

async function findArticleThumbnail(articleUrl: string) {
  try {
    const page = await fetchArticleHtml(articleUrl);
    return page ? findMetadataImage(page.html, page.url) : null;
  } catch {
    return null;
  }
}

/** 서명된 프록시와 R2 영구 캐시가 함께 사용하는 제한된 외부 이미지 fetch. */
export async function fetchNewsThumbnailImage(value: string, redirects = 0): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!isSafePublicNewsUrl(value) || redirects > 3) return null;

  const response = await fetch(value, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; MINION-News/1.0)",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(6000),
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) return null;
    return fetchNewsThumbnailImage(new URL(location, value).toString(), redirects + 1);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (!response.ok || !contentType.startsWith("image/") || contentLength > MAX_IMAGE_BYTES) return null;

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
  return { bytes, contentType };
}

/** 기사 URL이 같으면 배포·서버 인스턴스와 관계없이 항상 같은 불변 R2 key를 사용한다. */
export function newsThumbnailStoragePath(articleUrl: string) {
  const hash = createHash("sha256").update(articleUrl).digest("hex");
  return `news-thumbnails/v1/${hash}.webp`;
}

/** 원문을 다시 조회하지 않고 이미 생성된 R2 썸네일 URL만 찾는다. */
export async function getStoredNewsThumbnail(articleUrl: string): Promise<string | null> {
  if (!isSafePublicNewsUrl(articleUrl) || !isR2Configured()) return null;
  const path = newsThumbnailStoragePath(articleUrl);
  return await r2ObjectExists(path) ? r2PublicUrl(path) : null;
}

async function createPersistentNewsThumbnail(articleUrl: string): Promise<string | null> {
  try {
    const stored = await getStoredNewsThumbnail(articleUrl);
    if (stored) return stored;
  } catch (error) {
    console.error("[news-thumbnail] R2 lookup failed", error);
  }

  const sourceUrl = await findArticleThumbnail(articleUrl);
  if (!sourceUrl) return null;
  const proxyFallback = newsThumbnailProxyUrl(sourceUrl) ?? null;
  if (!isR2Configured()) return proxyFallback;

  try {
    const source = await fetchNewsThumbnailImage(sourceUrl);
    if (!source) return proxyFallback;
    const resized = await resizeImageForWeb(source.bytes, source.contentType, {
      maxEdge: 640,
      preserveGif: false,
    });
    // 변환 실패 원본을 .webp key에 잘못 저장하지 않고 기존 프록시로 안전하게 폴백한다.
    if (resized.contentType !== "image/webp") return proxyFallback;

    return await uploadToR2(
      newsThumbnailStoragePath(articleUrl),
      resized.bytes,
      resized.contentType,
      { cacheControl: NEWS_THUMBNAIL_CACHE_CONTROL },
    );
  } catch (error) {
    console.error("[news-thumbnail] R2 materialization failed", error);
    return proxyFallback;
  }
}

/** 동일 서버 인스턴스에서 겹친 페이지·resolve 요청은 하나의 변환 작업만 공유한다. */
export function materializeNewsThumbnail(articleUrl: string): Promise<string | null> {
  const existing = inFlightMaterializations.get(articleUrl);
  if (existing) return existing;

  const request = createPersistentNewsThumbnail(articleUrl).finally(() => {
    inFlightMaterializations.delete(articleUrl);
  });
  inFlightMaterializations.set(articleUrl, request);
  return request;
}

/** 피드 응답에는 이미 R2에 있는 URL만 붙여 외부 원문 조회 때문에 TTFB가 늘지 않게 한다. */
export async function attachStoredNewsThumbnails(articles: NewsArticle[]): Promise<NewsArticle[]> {
  if (!isR2Configured()) return articles;
  return Promise.all(articles.map(async (article) => {
    try {
      const stored = await getStoredNewsThumbnail(article.url);
      return stored ? { ...article, thumbnailUrl: stored } : article;
    } catch {
      return article;
    }
  }));
}

/** 응답 이후 제한된 병렬도로 누락 썸네일을 R2에 생성한다. */
export async function warmNewsThumbnails(articles: NewsArticle[], concurrency = 3) {
  const pending = articles.filter((article) => !article.thumbnailUrl || !isR2Url(article.thumbnailUrl));
  let completed = 0;
  let failed = 0;

  for (let index = 0; index < pending.length; index += concurrency) {
    const batch = pending.slice(index, index + concurrency);
    const results = await Promise.allSettled(batch.map((article) => materializeNewsThumbnail(article.url)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) completed += 1;
      else failed += 1;
    }
  }

  return { completed, failed, requested: pending.length };
}
