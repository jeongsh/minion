"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListFilter, X } from "lucide-react";

import { SearchInput } from "@/components/ui/search-input";
import { Button, buttonClassName } from "@/components/ui/button";
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
          options={[{ value: "", label: "전체 팀" }, ...teams.map((team) => ({ value: team.slug, label: team.shortName }))]}
          selected={selectedTeam}
          onSelect={selectTeam}
          rootClassName="min-w-[104px] sm:min-w-[124px]"
          triggerClassName="w-full"
          triggerIcon={selected ? <TeamLogo team={selected} plain themeAware size="h-5 w-5" /> : <ListFilter aria-hidden="true" className="text-[var(--ui-muted)]" size={17} />}
          triggerTypography="ui"
        />

        <form action="/news" className="flex min-w-0 flex-1 gap-1.5 sm:gap-2">
          {selectedTeam ? <input type="hidden" name="team" value={selectedTeam} /> : null}
          <SearchInput aria-label="뉴스 검색" name="q" defaultValue={query} placeholder="팀, 선수, 기사 제목 검색" />
          <Button type="submit" variant="neutral">검색</Button>
          {query ? (
            <Link href={newsHref(selectedTeam, "")} aria-label="검색어 지우기" className={buttonClassName({variant:"secondary",className:"w-10 !px-0"})}>
              <X aria-hidden="true" size={17} />
            </Link>
          ) : null}
        </form>
      </div>
    </section>
  );
}
