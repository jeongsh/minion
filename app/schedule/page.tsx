import Link from "next/link";
import { Suspense } from "react";

import { ScheduleList } from "@/components/domain/schedule-list";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { getAllTeams, getMatches, getStages, getTournaments } from "@/lib/data/lck";
import { filterMatchesBySegment, parseSeasonSegment, segmentLabel } from "@/lib/tournament-filters";
import { getMonthKST, getYearKST, KST_TIMEZONE } from "@/lib/view-data";

import { ScheduleFilters } from "./schedule-filters";

function currentKSTMonthYear() {
  const now = new Date();
  return {
    month: Number(new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, month: "numeric" }).format(now)),
    year: Number(new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, year: "numeric" }).format(now)),
  };
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; segment?: string; team?: string }>;
}) {
  const params = await searchParams;
  const defaults = currentKSTMonthYear();
  const activeYear = params.year ? Number(params.year) : defaults.year;
  const activeMonth = params.month ? Number(params.month) : defaults.month;
  const activeSegment = parseSeasonSegment(params.segment);
  const activeTeam = params.team ?? "all";

  const [matches, teams, tournaments, stages] = await Promise.all([
    getMatches(), getAllTeams(), getTournaments(), getStages(),
  ]);
  const years = Array.from(new Set([
    ...tournaments.map((item) => item.season).filter((year): year is number => Boolean(year)),
    activeYear,
  ])).sort((a, b) => b - a);
  const selectedTeam = teams.find((team) => team.id === activeTeam);
  const filtered = filterMatchesBySegment(matches, tournaments, activeSegment, activeYear)
    .filter((match) =>
      getYearKST(match.matchDate) === activeYear &&
      getMonthKST(match.matchDate) === activeMonth &&
      (!selectedTeam || match.teamAId === selectedTeam.id || match.teamBId === selectedTeam.id))
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

  return (
    <main className="subpage min-h-screen">
      <div className="mx-auto w-full max-w-[1240px] px-10 py-8 max-md:px-5">
        <Breadcrumb items={[{ label: "홈", href: "/" }, { label: "일정" }]} />
        <div className="mt-[30px] flex flex-wrap items-center justify-between gap-y-4">
          <Suspense fallback={null}>
            <ScheduleFilters
              activeYear={activeYear}
              activeMonth={activeMonth}
              activeSegment={activeSegment}
              activeTeam={activeTeam}
              years={years}
              teams={teams}
            />
          </Suspense>
          <Link href="/schedule" className="text-sm text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]">필터 초기화</Link>
        </div>
        <div className="mt-8">
          <ScheduleList
            matches={filtered}
            teams={teams}
            tournaments={tournaments}
            stages={stages}
            emptyMessage={`${activeYear}년 ${activeMonth}월 · ${segmentLabel(activeSegment, activeYear)} 조건에 해당하는 경기가 없습니다.`}
          />
        </div>
      </div>
    </main>
  );
}
