import type { Metadata } from "next";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { HomeCalendar, type HomeCalendarMatch } from "@/components/domain/home-calendar";
import { ScheduleList } from "@/components/domain/schedule-list";
import { ScheduleWeekScroller } from "@/components/domain/schedule-week-scroller";
import { SpoilerToggleButton } from "@/components/domain/spoiler-toggle-button";
import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import { getAllTeams, getMatches, getStages, getTournaments } from "@/lib/data/lck";
import { tournamentTypeLabel } from "@/lib/match-display";
import { shouldUseWhiteLogoOnDark } from "@/lib/team-logos";
import { filterMatchesBySegment, parseSeasonSegment, segmentLabel } from "@/lib/tournament-filters";
import { isSupportedSeasonYear } from "@/lib/tournaments/season-2026";
import { dateKeyKST, formatTimeKST, getMonthKST, getYearKST, KST_TIMEZONE, matchHref } from "@/lib/view-data";

import { ScheduleFilters } from "./schedule-filters";

export const metadata: Metadata = {
  title: "경기 일정 | MINION",
  description: "LCK 경기 일정과 결과를 한눈에 확인하세요.",
};

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
  const requestedMonth = params.month ? Number(params.month) : Number.NaN;
  const activeMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
    ? requestedMonth
    : defaults.month;
  const activeSegment = parseSeasonSegment(params.segment);
  const activeTeam = params.team ?? "all";

  const [matches, teams, tournaments, stages] = await Promise.all([getMatches(), getAllTeams(), getTournaments(), getStages()]);
  const requestedYear = params.year ? Number(params.year) : Number.NaN;
  const tournamentYears = tournaments.map((item) => item.season).filter(isSupportedSeasonYear);
  const yearCandidates = isSupportedSeasonYear(defaults.year) ? [...tournamentYears, defaults.year] : tournamentYears;
  const years = Array.from(new Set(yearCandidates)).sort((a, b) => b - a);
  const activeYear = years.includes(requestedYear) ? requestedYear : (years.includes(defaults.year) ? defaults.year : (years[0] ?? defaults.year));
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
    <main className="schedule-page text-[var(--ui-text)]">
      <div className="schedule-mobile-sticky sticky z-30 border-b border-[var(--ui-border)] bg-[var(--page-background)] shadow-[0_10px_20px_rgba(15,23,42,0.035)] lg:hidden">
        <div className="layout-wide py-2">
          <ScheduleWeekScroller dates={currentWeek} todayKey={todayKey} availableDateKeys={availableDateKeys} />
        </div>
      </div>

      <h1 className="sr-only">경기 일정</h1>

      <div className="sticky top-[var(--ui-header-height)] z-30 mt-2 hidden border-b border-[#e8e8eb] bg-[var(--page-background)] lg:block dark:border-[#383c44]">
        <div className="layout-wide flex items-center justify-between gap-3 py-2.5">
          {desktopFilters}
          <div className="flex shrink-0 items-center gap-3">
            <SpoilerToggleButton />
            <Link href="/schedule" className="text-[13px] font-bold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">필터 초기화</Link>
          </div>
        </div>
      </div>
      <div className="fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom)+18px)] right-4 z-40 flex flex-row gap-2 md:bottom-6 lg:hidden">
        <AdaptiveDialog
          title={`${activeYear}년 ${activeMonth}월 캘린더`}
          trigger={<><CalendarDays size={20} /><span className="sr-only">캘린더 열기</span></>}
          triggerClassName="grid h-12 w-12 place-items-center rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink)] shadow-[0_12px_34px_rgba(15,23,42,0.18)] transition-colors hover:bg-[var(--ui-card-hover)]"
        >
          <HomeCalendar initialMonthKey={`${activeYear}-${String(activeMonth).padStart(2, "0")}`} matches={calendarMatches} events={[]} />
        </AdaptiveDialog>
        <AdaptiveDialog
          title="일정 필터"
          trigger={<><SlidersHorizontal size={20} /><span className="sr-only">필터 열기</span></>}
          triggerClassName="grid h-12 w-12 place-items-center rounded-full border border-[var(--ui-border)] bg-[var(--ui-ink)] text-[var(--ui-surface)] shadow-[0_12px_34px_rgba(15,23,42,0.22)] transition-opacity hover:opacity-90"
        >
          {mobileFilters}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)] px-3 py-2.5">
            <span className="text-[14px] font-medium text-[var(--ui-ink)]">경기 결과 스포방지</span>
            <SpoilerToggleButton />
          </div>
          <Link href="/schedule" className="mt-4 flex min-h-10 items-center justify-center rounded-lg bg-[var(--ui-ink)] px-3 text-[12px] font-medium text-[var(--ui-surface)]">필터 초기화</Link>
        </AdaptiveDialog>
      </div>
      <div className="layout-wide">
        <div className="mt-7 lg:mt-10"><ScheduleList matches={filtered} teams={teams} tournaments={tournaments} stages={stages} emptyMessage={`${activeYear}년 ${activeMonth}월 · ${segmentLabel(activeSegment, activeYear)} 조건에 해당하는 경기가 없습니다.`} /></div>
      </div>
    </main>
  );
}
