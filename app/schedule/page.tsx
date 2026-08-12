import { CalendarDays, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { HomeCalendar, type HomeCalendarMatch } from "@/components/domain/home-calendar";
import { ScheduleList } from "@/components/domain/schedule-list";
import { ScheduleWeekScroller } from "@/components/domain/schedule-week-scroller";
import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import { getAllTeams, getMatches, getStages, getTournaments } from "@/lib/data/lck";
import { tournamentTypeLabel } from "@/lib/match-display";
import { shouldUseWhiteLogoOnDark } from "@/lib/team-logos";
import { filterMatchesBySegment, parseSeasonSegment, segmentLabel } from "@/lib/tournament-filters";
import { dateKeyKST, formatTimeKST, getMonthKST, getYearKST, KST_TIMEZONE, matchHref } from "@/lib/view-data";

import { ScheduleFilters } from "./schedule-filters";

function currentKSTMonthYear() {
  const now = new Date();
  return {
    month: Number(new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, month: "numeric" }).format(now)),
    year: Number(new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, year: "numeric" }).format(now)),
  };
}

function weekDates() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { key: dateKeyKST(date), day: date.getDate(), weekday: ["월", "화", "수", "목", "금", "토", "일"][index] };
  });
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

  const [matches, teams, tournaments, stages] = await Promise.all([getMatches(), getAllTeams(), getTournaments(), getStages()]);
  const years = Array.from(new Set([...tournaments.map((item) => item.season).filter((year): year is number => Boolean(year)), activeYear])).sort((a, b) => b - a);
  const selectedTeam = teams.find((team) => team.id === activeTeam);
  const filtered = filterMatchesBySegment(matches, tournaments, activeSegment, activeYear)
    .filter((match) => getYearKST(match.matchDate) === activeYear && getMonthKST(match.matchDate) === activeMonth && (!selectedTeam || match.teamAId === selectedTeam.id || match.teamBId === selectedTeam.id))
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const currentWeek = weekDates();
  const todayKey = dateKeyKST(new Date());
  const availableDateKeys = Array.from(new Set(filtered.map((match) => dateKeyKST(match.matchDate))));
  const calendarMatches: HomeCalendarMatch[] = filtered.map((match) => {
    const teamA = teamMap.get(match.teamAId);
    const teamB = teamMap.get(match.teamBId);
    return {
      id: match.id,
      dateKey: dateKeyKST(match.matchDate),
      href: matchHref(match),
      time: formatTimeKST(match.matchDate),
      league: tournamentTypeLabel(tournamentMap.get(match.tournamentId)),
      teamAName: teamA?.shortName || teamA?.name || "TBD",
      teamBName: teamB?.shortName || teamB?.name || "TBD",
      teamALogoUrl: teamA?.logoUrl ?? null,
      teamBLogoUrl: teamB?.logoUrl ?? null,
      teamALogoDarkUrl: shouldUseWhiteLogoOnDark(teamA) ? teamA?.logoWhiteUrl : null,
      teamBLogoDarkUrl: shouldUseWhiteLogoOnDark(teamB) ? teamB?.logoWhiteUrl : null,
    };
  });
  const mobileFilters = <Suspense fallback={null}><ScheduleFilters activeYear={activeYear} activeMonth={activeMonth} activeSegment={activeSegment} activeTeam={activeTeam} years={years} teams={teams} layout="sheet" /></Suspense>;
  const desktopFilters = <Suspense fallback={null}><ScheduleFilters activeYear={activeYear} activeMonth={activeMonth} activeSegment={activeSegment} activeTeam={activeTeam} years={years} teams={teams} /></Suspense>;

  return (
    <main className="schedule-page min-h-screen text-[var(--ui-text)]">
      <div className="sticky top-[var(--ui-header-height)] z-30 border-b border-[var(--ui-border)] bg-[var(--page-background)] shadow-[0_10px_20px_rgba(15,23,42,0.035)] md:hidden">
        <div className="layout-wide py-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0"><h1 className="home-section-title font-paperozi text-[18px] leading-tight text-[var(--ui-ink)]">경기 일정</h1></div>
          <div className="flex items-center gap-1">
            <AdaptiveDialog title={`${activeYear}년 ${activeMonth}월 캘린더`} trigger={<><CalendarDays size={17} /><span className="sr-only">캘린더 열기</span></>} triggerClassName="grid h-9 w-9 place-items-center rounded-xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)] text-[var(--ui-ink)] transition-colors hover:bg-[var(--ui-card-hover)]"><HomeCalendar initialMonthKey={`${activeYear}-${String(activeMonth).padStart(2, "0")}`} matches={calendarMatches} events={[]} /></AdaptiveDialog>
            <AdaptiveDialog title="일정 필터" trigger={<><SlidersHorizontal size={17} /><span className="sr-only">필터 열기</span></>} triggerClassName="grid h-9 w-9 place-items-center rounded-xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)] text-[var(--ui-ink)] transition-colors hover:bg-[var(--ui-card-hover)]">{mobileFilters}<Link href="/schedule" className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-[var(--ui-ink)] px-4 text-sm font-black text-[var(--ui-surface)]">필터 초기화</Link></AdaptiveDialog>
          </div>
          </div>
          <ScheduleWeekScroller dates={currentWeek} todayKey={todayKey} availableDateKeys={availableDateKeys} />
        </div>
      </div>

      <div className="layout-wide pt-5 sm:pt-7">
        <div className="hidden items-end justify-between md:flex">
          <div><h1 className="home-section-title font-paperozi text-[24px] leading-tight text-[var(--ui-ink)] lg:text-[28px]">경기 일정</h1></div>
          <p className="rounded-full bg-[var(--ui-card-bg)] px-3 py-1.5 text-[13px] font-bold text-[var(--ui-muted)]">{filtered.length}경기</p>
        </div>
      </div>

      <div className="sticky top-[var(--ui-header-height)] z-30 mt-2 hidden border-b border-[#e8e8eb] bg-[var(--page-background)] md:block dark:border-[#383c44]">
        <div className="layout-wide flex items-center justify-between gap-3 py-2.5">{desktopFilters}<Link href="/schedule" className="shrink-0 text-[13px] font-bold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">필터 초기화</Link></div>
      </div>
      <div className="layout-wide pb-16">
        <div className="mt-7 md:mt-10"><ScheduleList matches={filtered} teams={teams} tournaments={tournaments} stages={stages} emptyMessage={`${activeYear}년 ${activeMonth}월 · ${segmentLabel(activeSegment, activeYear)} 조건에 해당하는 경기가 없습니다.`} /></div>
      </div>
    </main>
  );
}
