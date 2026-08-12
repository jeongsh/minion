import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, X } from "lucide-react";
import { NewsCard } from "@/components/news/news-card";
import { Pagination } from "@/components/ui/pagination";
import { TeamLogo } from "@/components/ui/team-logo";
import { formatNewsDate } from "@/lib/data/news";
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
    scanLimit: PAGE_SIZE * MAX_NEWS_PAGES,
  });
  const totalPages = Math.max(1, Math.min(MAX_NEWS_PAGES, Math.ceil(newsFeed.total / PAGE_SIZE)));
  if (parsedPage !== requestedPage || requestedPage > totalPages) {
    redirect(newsHref(selectedTeam, query, Math.min(requestedPage, totalPages)));
  }

  const pageArticles = newsFeed.articles;

  return (
    <main className="layout-wide pb-16 pt-5 text-[var(--ui-ink)] sm:pt-7">
      <header className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="home-section-title font-paperozi text-[24px] leading-tight text-[var(--ui-ink)] lg:text-[28px]">LCK 뉴스</h1>
          <p className="mt-1 text-[13px] text-[var(--ui-muted)] sm:text-sm">리그와 팀별 기사를 모아보고 원문 매체에서 이어서 읽어요.</p>
        </div>
          <div className="text-[12px] font-semibold text-[var(--ui-muted)]">
          {pageArticles[0]
            ? `최근 업데이트 ${formatNewsDate(pageArticles[0].publishedAt, true)}`
            : "새 뉴스 확인 중"}
        </div>
      </header>

      <section aria-label="뉴스 필터" className="mb-7 rounded-xl bg-[var(--ui-card-bg)] p-2.5">
        <nav aria-label="팀별 뉴스" className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={newsHref("", query)}
            aria-current={!selectedTeam ? "page" : undefined}
            className={`font-paperozi flex min-h-12 shrink-0 items-center rounded-lg px-3 text-[13px] font-bold transition-colors ${!selectedTeam ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]"}`}
          >
            전체
          </Link>
          {teams.map((team) => {
            const active = selectedTeam === team.slug;
            return (
              <Link
                key={team.id}
                href={newsHref(team.slug, query)}
                aria-current={active ? "page" : undefined}
                className={`font-paperozi flex min-h-12 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold transition-colors ${active ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]"}`}
              >
                <TeamLogo team={team} themeAware size="h-8 w-8" imageClassName="h-6 w-6 object-contain" />
                {team.shortName}
              </Link>
            );
          })}
        </nav>

        <form action="/news" className="mt-2 flex gap-2">
          {selectedTeam ? <input type="hidden" name="team" value={selectedTeam} /> : null}
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">뉴스 검색</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-muted)]" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="팀, 선수, 기사 제목 검색"
              className="h-10 w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] pl-9 pr-3 text-[13px] font-semibold outline-none transition placeholder:text-[var(--ui-muted)] focus:border-[var(--ui-ink)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ui-ink)_12%,transparent)]"
            />
          </label>
          <button type="submit" className="min-h-10 shrink-0 rounded-md bg-[var(--ui-ink)] px-4 text-[13px] font-black text-[var(--ui-surface)] transition active:scale-[0.97]">검색</button>
          {query ? (
            <Link href={newsHref(selectedTeam, "")} aria-label="검색어 지우기" className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[var(--ui-border)] text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]">
              <X size={17} />
            </Link>
          ) : null}
        </form>
      </section>

      <section aria-labelledby="latest-news">
        <div className="mb-1 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 id="latest-news" className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">
              {query ? "검색 결과" : selectedTeamData ? `${selectedTeamData.shortName} 뉴스` : "최신 뉴스"}
            </h2>
            <span className="text-[12px] font-semibold text-[var(--ui-muted)]">현재 {pageArticles.length}건</span>
          </div>
          {(selectedTeam || query) ? <Link href="/news" className="flex min-h-10 items-center text-[12px] font-extrabold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">필터 초기화</Link> : null}
        </div>

        {pageArticles.length > 0 ? (
          <div className="grid gap-2">
            {pageArticles.map((article) => <NewsCard key={article.id} article={article} />)}
          </div>
        ) : (
          <div className="rounded-xl bg-[var(--ui-card-bg)] px-5 py-12 text-center">
            <Search className="mx-auto text-[var(--ui-muted)]" size={28} />
            <p className="mt-3 font-black">조건에 맞는 뉴스가 없어요.</p>
            <p className="mt-1 text-sm text-[var(--ui-muted)]">다른 팀이나 검색어로 다시 찾아보세요.</p>
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

        <p className="mt-6 text-[12px] leading-relaxed text-[var(--ui-muted)]">
        {newsFeed.isFallback
          ? "뉴스를 불러오지 못해 임시 데이터를 표시하고 있습니다."
          : "기사 제목을 선택하면 해당 언론사의 원문으로 이동합니다."}
      </p>
    </main>
  );
}
