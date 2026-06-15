import Link from "next/link";
import { Suspense } from "react";

import { SourceNotice } from "@/components/domain/source-notice";
import { getMatches, getStages, getTeams, getTournaments } from "@/lib/data/lck";
import type { Match, Team } from "@/lib/types";
import {
  formatDateHeaderKST,
  formatTimeKST,
  getMonthKST,
  getYearKST,
  KST_TIMEZONE,
} from "@/lib/view-data";

import { ScheduleFilters } from "./schedule-filters";

function statusLabel(status: Match["status"]) {
  if (status === "completed") {
    return "종료";
  }

  if (status === "live") {
    return "진행";
  }

  return "예정";
}

function stageName(stages: Awaited<ReturnType<typeof getStages>>, stageId: string) {
  return stages.find((stage) => stage.id === stageId)?.name ?? "-";
}

function teamById(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId);
}

function scoreText(match: Match) {
  if (match.teamAScore === null || match.teamBScore === null) {
    return "vs";
  }

  return `${match.teamAScore} : ${match.teamBScore}`;
}

function TeamMark({ team, align = "left" }: { team?: Team; align?: "left" | "right" }) {
  if (!team) {
    return <span className="font-semibold">-</span>;
  }

  const badge = (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface-muted text-xs font-bold"
      style={{ color: team.primaryColor }}
      aria-hidden="true"
    >
      {team.shortName.slice(0, 3)}
    </span>
  );

  return (
    <span className={`flex items-center gap-3 ${align === "right" ? "justify-end" : ""}`}>
      {align === "right" ? null : badge}
      <span className="font-semibold">{team.name}</span>
      {align === "right" ? badge : null}
    </span>
  );
}

function currentKSTMonthYear() {
  const now = new Date();
  return {
    month: Number(
      new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, month: "numeric" }).format(now),
    ),
    year: Number(
      new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, year: "numeric" }).format(now),
    ),
  };
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const { month: defaultMonth, year: defaultYear } = currentKSTMonthYear();

  const [matches, teams, tournaments, stages] = await Promise.all([
    getMatches(),
    getTeams(),
    getTournaments(),
    getStages(),
  ]);

  const activeYear = params.year ? Number(params.year) : defaultYear;
  const activeMonth = params.month ? Number(params.month) : defaultMonth;

  const filteredMatches = matches.filter(
    (match) => getYearKST(match.matchDate) === activeYear && getMonthKST(match.matchDate) === activeMonth,
  );

  const sortedMatches = [...filteredMatches].sort(
    (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
  );

  const activeTournament = tournaments[0];
  const dateGroups = sortedMatches.reduce<Record<string, Match[]>>((groups, match) => {
    const key = formatDateHeaderKST(match.matchDate);

    return {
      ...groups,
      [key]: [...(groups[key] ?? []), match],
    };
  }, {});

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-8">
      <section className="flex flex-col gap-6" aria-labelledby="schedule-title">
        <h1 id="schedule-title" className="text-2xl font-bold">
          {activeTournament?.name ?? "LCK"} 경기 일정
        </h1>

        <Suspense fallback={null}>
          <ScheduleFilters activeYear={activeYear} activeMonth={activeMonth} />
        </Suspense>

        <div className="flex items-center gap-4 overflow-x-auto border-b border-border pb-4">
          <button type="button" className="flex items-center gap-2 pr-4 text-sm font-semibold">
            <span className="text-2xl leading-none">≡</span>
            전체
          </button>
          {teams.map((team) => (
            <button key={team.id} type="button" className="flex min-w-fit items-center gap-2 text-sm text-muted">
              <span
                className="grid size-7 place-items-center rounded-full bg-surface-muted text-[10px] font-bold"
                style={{ color: team.primaryColor }}
              >
                {team.shortName.slice(0, 3)}
              </span>
              {team.shortName}
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-surface" aria-label="경기 목록">
        {Object.keys(dateGroups).length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted">
            {activeYear}년 {activeMonth}월에 예정된 경기가 없습니다.
          </div>
        ) : (
          Object.entries(dateGroups).map(([date, groupMatches]) => (
            <div key={date}>
              <div className="border-b border-border bg-surface-muted px-5 py-4">
                <h2 className="text-xl font-black">{date}</h2>
              </div>
              <div className="divide-y divide-border">
                {groupMatches.map((match) => {
                  const teamA = teamById(teams, match.teamAId);
                  const teamB = teamById(teams, match.teamBId);

                  return (
                    <div
                      key={match.id}
                      className="grid gap-4 px-5 py-4 md:grid-cols-[4.5rem_4.5rem_7rem_minmax(12rem,1fr)_5rem_minmax(12rem,1fr)_6rem_8rem] md:items-center"
                    >
                      <time className="text-base font-bold">{formatTimeKST(match.matchDate)}</time>
                      <span className="w-fit rounded bg-surface-muted px-2 py-1 text-xs font-semibold text-muted">
                        {statusLabel(match.status)}
                      </span>
                      <span className="text-sm text-muted">{stageName(stages, match.stageId)}</span>
                      <Link href={`/teams/${teamA?.slug ?? ""}`} className="min-w-0">
                        <TeamMark team={teamA} align="right" />
                      </Link>
                      <Link href={`/matches/${match.id}`} className="text-center text-2xl font-black">
                        {scoreText(match)}
                      </Link>
                      <Link href={`/teams/${teamB?.slug ?? ""}`} className="min-w-0">
                        <TeamMark team={teamB} />
                      </Link>
                      <Link
                        href={`/matches/${match.id}`}
                        className="rounded-md border border-border px-3 py-2 text-center text-sm font-semibold"
                      >
                        상세
                      </Link>
                      <span className="text-sm text-muted md:text-right">{match.venue ?? "경기장 미정"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      <SourceNotice />
    </main>
  );
}
