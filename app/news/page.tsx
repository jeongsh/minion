import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { NewsFilter } from "@/components/news/news-filter";
import { NewsFeedLayout } from "@/components/news/home-news-section";
import { Pagination } from "@/components/ui/pagination";
import { getNewsFeed } from "@/lib/data/naver-news";
import { teams } from "@/lib/team-themes";

export const metadata: Metadata = {
  title: "LCK 뉴스 | MINION",
  description: "LCK 전체 소식과 팀별 최신 뉴스를 한곳에서 확인하세요.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 10;
const MAX_NEWS_PAGES = 10;

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function newsHref(team: string, query: string, page = 1) {
  const params = new URLSearchParams();
  if (team) params.set("team", team);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/news?${suffix}` : "/news";
}

export default async function NewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedTeam = singleValue(params.team);
  const query = singleValue(params.q).trim();
  const selectedTeamData = teams.find((team) => team.slug === selectedTeam);
  const parsedPage = Number.parseInt(singleValue(params.page), 10) || 1;
  const requestedPage = Math.min(Math.max(parsedPage, 1), MAX_NEWS_PAGES);
  const newsFeed = await getNewsFeed({
    teamSlug: selectedTeamData?.slug,
    query,
    display: PAGE_SIZE,
    start: (requestedPage - 1) * PAGE_SIZE + 1,
  });
  const totalPages = Math.max(1, Math.min(MAX_NEWS_PAGES, Math.ceil(newsFeed.total / PAGE_SIZE)));
  if (parsedPage !== requestedPage || requestedPage > totalPages) {
    redirect(newsHref(selectedTeam, query, Math.min(requestedPage, totalPages)));
  }

  const pageArticles = newsFeed.articles;

  return (
    <main className="layout-wide pb-16 pt-4 text-[var(--ui-ink)] min-[390px]:pt-5 sm:pt-7">
      {/* <header className="mb-4 flex flex-col gap-1.5 min-[390px]:mb-5 min-[390px]:gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="home-section-title font-paperozi text-[20px] leading-tight text-[var(--ui-ink)] min-[390px]:text-[22px] sm:text-[24px] lg:text-[28px]">LCK 뉴스</h1>
          <p className="mt-1 text-[11.5px] text-[var(--ui-muted)] min-[390px]:text-[12px] sm:text-sm">리그와 팀별 기사를 모아보고 원문 매체에서 이어서 읽어요.</p>
        </div>
          <div className="text-[12px] font-medium text-[var(--ui-muted)]">
          {pageArticles[0]
            ? `최근 업데이트 ${formatNewsDate(pageArticles[0].publishedAt, true)}`
            : "새 뉴스 확인 중"}
        </div>
      </header> */}

      <NewsFilter query={query} selectedTeam={selectedTeam} teams={teams} />

      <section aria-labelledby="latest-news">
        <div className="mb-1 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 id="latest-news" className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">
              {query ? "검색 결과" : selectedTeamData ? `${selectedTeamData.shortName} 뉴스` : "최신 뉴스"}
            </h2>
            <span className="text-[13px] font-medium text-[var(--ui-muted)]">현재 {pageArticles.length}건</span>
          </div>
          {(selectedTeam || query) ? <Link href="/news" className="flex min-h-10 items-center text-[13px] font-medium text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">필터 초기화</Link> : null}
        </div>

        {pageArticles.length > 0 ? (
          <NewsFeedLayout articles={pageArticles} cardSize="news" featured={false} />
        ) : (
          <div className="rounded-xl bg-[var(--ui-card-bg)] px-5 py-12 text-center">
            <Search className="mx-auto text-[var(--ui-muted)]" size={28} />
            <p className="mt-3 text-[16px] font-bold leading-6">조건에 맞는 뉴스가 없어요.</p>
            <p className="mt-1 text-[16px] leading-6 text-[var(--ui-muted)]">다른 팀이나 검색어로 다시 찾아보세요.</p>
          </div>
        )}
      </section>

      {totalPages > 1 ? (
        <Pagination
          page={requestedPage}
          totalPages={totalPages}
          getHref={(page) => newsHref(selectedTeam, query, page)}
          className="mt-6"
        />
      ) : null}

        <p className="mt-6 text-[13px] leading-5 text-[var(--ui-muted)]">
        {newsFeed.isFallback
          ? "뉴스를 불러오지 못해 임시 데이터를 표시하고 있습니다."
          : "기사 제목을 선택하면 해당 언론사의 원문으로 이동합니다."}
      </p>
    </main>
  );
}
