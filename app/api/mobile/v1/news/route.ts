import type { MobileNewsDto } from "@/packages/contracts/src/mobile-v1";
import { getNewsFeed } from "@/lib/data/naver-news";
import { mobileSuccess } from "@/lib/mobile/api-response";

export const revalidate = 60;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim();
  const teamSlug = params.get("team") || null;
  const cursor = Math.max(0, Number(params.get("cursor")) || 0);
  const limit = 12;
  const feed = await getNewsFeed({ display: limit, query, scanLimit: 120, start: cursor + 1, teamSlug: teamSlug ?? undefined });
  const next = cursor + feed.articles.length;
  const data: MobileNewsDto = {
    hasMore: next < feed.total && feed.articles.length === limit,
    isFallback: feed.isFallback,
    items: feed.articles.map((article) => ({ id: article.id, publishedAt: article.publishedAt, source: article.source, thumbnail: article.thumbnailUrl ? { url: article.thumbnailUrl } : null, title: article.title, url: article.url })),
    nextCursor: next < feed.total ? String(next) : null,
    query,
    teamSlug,
    total: feed.total,
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } });
}
