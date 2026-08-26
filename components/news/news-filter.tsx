"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListFilter, Search, X } from "lucide-react";

import { FilterDropdown } from "@/components/match-filter-dropdown";
import { TeamLogo } from "@/components/ui/team-logo";

type NewsFilterTeam = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  logoUrl: string;
  logoWhiteUrl: string;
  useWhiteLogoOnDark?: boolean;
};

function newsHref(team: string, query: string) {
  const params = new URLSearchParams();
  if (team) params.set("team", team);
  if (query) params.set("q", query);
  const suffix = params.toString();
  return suffix ? `/news?${suffix}` : "/news";
}

export function NewsFilter({ query, selectedTeam, teams }: { query: string; selectedTeam: string; teams: NewsFilterTeam[] }) {
  const router = useRouter();
  const selected = teams.find((team) => team.slug === selectedTeam);

  const selectTeam = (slug: string) => {
    router.replace(newsHref(slug, query), { scroll: false });
  };

  return (
    <section aria-label="뉴스 필터" className="relative z-20 mb-4 rounded-lg bg-[var(--ui-card-bg)] p-1.5 sm:mb-7 sm:rounded-xl sm:p-2.5">
      <div className="flex min-w-0 gap-1.5 sm:gap-2">
        <FilterDropdown
          ariaLabel="뉴스 팀 선택"
          controlSize="compact"
          options={[{ value: "", label: "전체 팀" }, ...teams.map((team) => ({ value: team.slug, label: team.shortName }))]}
          selected={selectedTeam}
          onSelect={selectTeam}
          rootClassName="min-w-[104px] sm:min-w-[124px]"
          triggerClassName="h-8 w-full justify-between rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 text-[var(--ui-text)] outline-none focus-visible:border-[var(--ui-ink)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ui-ink)_12%,transparent)]"
          triggerIcon={selected ? <TeamLogo team={selected} plain themeAware size="h-5 w-5" /> : <ListFilter aria-hidden="true" className="text-[var(--ui-muted)]" size={17} />}
          triggerTypography="ui"
        />

        <form action="/news" className="flex min-w-0 flex-1 gap-1.5 sm:gap-2">
          {selectedTeam ? <input type="hidden" name="team" value={selectedTeam} /> : null}
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">뉴스 검색</span>
            <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-muted)]" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="팀, 선수, 기사 제목 검색"
              className="h-8 w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] pl-9 pr-3 text-[13px] font-medium outline-none transition placeholder:text-[var(--ui-muted)] focus:border-[var(--ui-ink)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ui-ink)_12%,transparent)]"
            />
          </label>
          <button type="submit" className="h-8 shrink-0 rounded-md bg-[var(--ui-ink)] px-3 text-[13px] font-medium text-[var(--ui-surface)] transition active:scale-[0.97] sm:px-4">검색</button>
          {query ? (
            <Link href={newsHref(selectedTeam, "")} aria-label="검색어 지우기" className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--ui-border)] text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]">
              <X aria-hidden="true" size={17} />
            </Link>
          ) : null}
        </form>
      </div>
    </section>
  );
}
