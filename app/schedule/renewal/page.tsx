import Link from "next/link";
import { Suspense } from "react";

import { ScheduleListRenewal } from "@/components/domain/schedule-list-renewal";
import { PageHeader } from "@/components/ui/page-header";
import { getAllTeams, getMatches, getStages, getTournaments } from "@/lib/data/lck";
import { filterMatchesBySegment, parseSeasonSegment, segmentLabel } from "@/lib/tournament-filters";
import { getMonthKST, getYearKST, KST_TIMEZONE } from "@/lib/view-data";

import { ScheduleFilters } from "../schedule-filters";

function currentKSTMonthYear() {
  const now = new Date();
  return {
    month: Number(new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, month: "numeric" }).format(now)),
    year: Number(new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, year: "numeric" }).format(now)),
  };
}

export default async function ScheduleRenewalPage({
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
    <main className="schedule-page min-h-screen bg-[var(--ui-surface)] text-[var(--ui-text)]">
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-16 pt-8 xl:px-10">
        <PageHeader
          eyebrow="MATCH SCHEDULE · RENEWAL"
          title="경기 일정"
          action={
            <Link
              href="/schedule"
              className="rounded-full bg-[var(--ui-surface-muted)] px-3 py-1.5 text-xs font-bold text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-ink)]"
            >
              예전 디자인으로
            </Link>
          }
        />
        <div className="sticky top-16 z-30 -mx-5 mt-8 border-b border-[#e8e8eb] bg-[var(--ui-surface)]/95 px-5 py-4 backdrop-blur dark:border-[#383c44] xl:-mx-10 xl:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Suspense fallback={null}>
              <ScheduleFilters
                activeYear={activeYear}
                activeMonth={activeMonth}
                activeSegment={activeSegment}
                activeTeam={activeTeam}
                years={years}
                teams={teams}
                pathname="/schedule/renewal"
              />
            </Suspense>
            <Link href="/schedule/renewal" className="text-xs font-bold text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-ink)]">필터 초기화</Link>
          </div>
        </div>
        <div className="mt-10">
          <ScheduleListRenewal
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
