import type { MobileNewsDto } from "@/packages/contracts/src/mobile-v1";
import { getNewsFeed } from "@/lib/data/naver-news";
import { scheduleNewsThumbnailWarmup } from "@/lib/data/news-thumbnail-warmup";
import { mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";
import { teams } from "@/lib/team-themes";

export const revalidate = 60;

const PAGE_SIZE = 10;
const MAX_NEWS_PAGES = 10;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim();
  const teamSlug = params.get("team") || null;
  const requestedPage = Math.min(Math.max(Number.parseInt(params.get("page") ?? "1", 10) || 1, 1), MAX_NEWS_PAGES);
  let page = requestedPage;
  let feed = await getNewsFeed({ display: PAGE_SIZE, query, start: (page - 1) * PAGE_SIZE + 1, teamSlug: teamSlug ?? undefined });
  const totalPages = Math.max(1, Math.min(MAX_NEWS_PAGES, Math.ceil(feed.total / PAGE_SIZE)));
  if (page > totalPages) {
    page = totalPages;
    feed = await getNewsFeed({ display: PAGE_SIZE, query, start: (page - 1) * PAGE_SIZE + 1, teamSlug: teamSlug ?? undefined });
  }
  scheduleNewsThumbnailWarmup(feed.articles);
  const next = page * PAGE_SIZE;
  const data: MobileNewsDto = {
    hasMore: page < totalPages,
    isFallback: feed.isFallback,
    items: feed.articles.map((article) => ({ id: article.id, publishedAt: article.publishedAt, source: article.source, thumbnail: article.thumbnailUrl ? { url: article.thumbnailUrl } : null, title: article.title, url: article.url })),
    nextCursor: page < totalPages ? String(next) : null,
    page,
    query,
    teamSlug,
    teams: teams.map(toMobileTeam),
    total: feed.total,
    totalPages,
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } });
}
