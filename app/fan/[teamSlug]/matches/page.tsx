import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ScheduleList } from "@/components/domain/schedule-list";
import { FanPageShell } from "@/components/fan/fan-page-shell";
import { getAllTeams, getMatches, getStages, getTeamByFanSiteHost, getTeamBySlug, getTournaments } from "@/lib/data/lck";
import { filterMatchesBySegment, parseSeasonSegment, segmentLabel } from "@/lib/tournament-filters";
import { getMonthKST, getYearKST, KST_TIMEZONE } from "@/lib/view-data";

import { ScheduleFilters } from "@/app/schedule/schedule-filters";

export const dynamic = "force-dynamic";

function currentKSTMonthYear() {
  const now = new Date();
  return {
    month: Number(new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, month: "numeric" }).format(now)),
    year: Number(new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, year: "numeric" }).format(now)),
  };
}

export default async function FanSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ year?: string; month?: string; segment?: string }>;
}) {
  const { teamSlug } = await params;
  const query = await searchParams;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  const defaults = currentKSTMonthYear();
  const activeYear = query.year ? Number(query.year) : defaults.year;
  const activeMonth = query.month ? Number(query.month) : defaults.month;
  const activeSegment = parseSeasonSegment(query.segment);
  const [teams, matches, tournaments, stages] = await Promise.all([
    getAllTeams(), getMatches(), getTournaments(), getStages(),
  ]);
  const years = Array.from(new Set([
    ...tournaments.map((item) => item.season).filter((year): year is number => Boolean(year)),
    activeYear,
  ])).sort((a, b) => b - a);
  const filtered = filterMatchesBySegment(matches, tournaments, activeSegment, activeYear)
    .filter((match) =>
      (match.teamAId === team.id || match.teamBId === team.id) &&
      getYearKST(match.matchDate) === activeYear &&
      getMonthKST(match.matchDate) === activeMonth)
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const pathname = `/fan/${teamSlug}/matches`;

  return (
    <FanPageShell eyebrow={`${team.shortName} Schedule`} title="일정">
      <div className="subpage flex flex-col gap-6 !bg-[var(--ui-surface)]">
        <div className="flex flex-wrap items-center justify-between gap-y-4">
          <Suspense fallback={null}>
            <ScheduleFilters
              activeYear={activeYear}
              activeMonth={activeMonth}
              activeSegment={activeSegment}
              activeTeam={team.id}
              years={years}
              teams={teams}
              pathname={pathname}
              lockTeam
            />
          </Suspense>
          <Link href={pathname} className="text-sm text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]">기간 필터 초기화</Link>
        </div>
        <ScheduleList
          matches={filtered}
          teams={teams}
          tournaments={tournaments}
          stages={stages}
          emptyMessage={`${activeYear}년 ${activeMonth}월 · ${segmentLabel(activeSegment, activeYear)}에 ${team.shortName} 경기가 없습니다.`}
        />
      </div>
    </FanPageShell>
  );
}
