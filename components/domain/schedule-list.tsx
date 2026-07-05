import Link from "next/link";

import { ScheduleTodayScroll } from "@/components/domain/schedule-today-scroll";
import { TeamLogo } from "@/components/ui/team-logo";
import { matchStatusLabel, stageName, tournamentTypeLabel } from "@/lib/match-display";
import type { Match, Stage, Team, Tournament } from "@/lib/types";
import { formatTimeKST, KST_TIMEZONE, matchHref } from "@/lib/view-data";

const TODAY_SECTION_ID = "schedule-today";

function dateHeading(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(value));
}

/** KST 기준 YYYY-MM-DD 키 (오늘 날짜 비교용) */
function dateKeyKST(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function ScheduleList({
  matches,
  teams,
  tournaments,
  stages,
  emptyMessage,
}: {
  matches: Match[];
  teams: Team[];
  tournaments: Tournament[];
  stages: Stage[];
  emptyMessage: string;
}) {
  const groups = matches.reduce<Record<string, Match[]>>((result, match) => {
    const key = dateHeading(match.matchDate);
    return { ...result, [key]: [...(result[key] ?? []), match] };
  }, {});

  if (matches.length === 0) {
    return <p className="rounded-2xl bg-[var(--ui-surface-muted)] py-16 text-center text-sm text-[var(--ui-muted)]">{emptyMessage}</p>;
  }

  const todayKey = dateKeyKST(new Date());
  const entries = Object.entries(groups); // matchDate 오름차순 정렬 유지
  // 스크롤 대상: 오늘 → 없으면 오늘 이후 가장 가까운 날 → 없으면 마지막(가장 최근) 날
  const scrollTargetKey =
    entries.find(([, day]) => dateKeyKST(day[0].matchDate) >= todayKey)?.[0] ??
    entries[entries.length - 1]?.[0];

  return (
    <div className="flex flex-col gap-8 pb-1">
      {scrollTargetKey && <ScheduleTodayScroll targetId={TODAY_SECTION_ID} />}
      {entries.map(([date, dayMatches]) => {
        const isToday = dateKeyKST(dayMatches[0].matchDate) === todayKey;

        return (
        <section key={date} id={date === scrollTargetKey ? TODAY_SECTION_ID : undefined} className="scroll-mt-40">
          <h2 className="home-section-title mb-3 flex items-center gap-2 text-[20px] text-[var(--ui-ink)]">
            {date}
            {isToday && <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-foreground)]">오늘</span>}
          </h2>
          <div className={`overflow-hidden rounded-2xl border bg-[var(--ui-surface)] ${isToday ? "border-2 border-[var(--accent)]" : "border-[var(--ui-border)]"}`}>
            {dayMatches.map((match) => {
              const teamA = teams.find((team) => team.id === match.teamAId);
              const teamB = teams.find((team) => team.id === match.teamBId);
              const tournament = tournaments.find((item) => item.id === match.tournamentId);
              const score = match.teamAScore === null || match.teamBScore === null
                ? "vs"
                : `${match.teamAScore} : ${match.teamBScore}`;

              return (
                <Link
                  href={matchHref(match)}
                  key={match.id}
                  className="grid grid-cols-1 items-center gap-4 border-b border-[var(--ui-border)] px-4 py-4 transition-colors last:border-b-0 hover:bg-[var(--ui-surface-muted)] md:grid-cols-[180px_minmax(0,1fr)_180px] md:px-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex w-[66px] shrink-0 flex-col gap-1">
                      <time className="text-base font-black tracking-tight text-[var(--ui-ink)]">{formatTimeKST(match.matchDate)}</time>
                      <span className="w-fit rounded-full bg-[var(--ui-surface-muted)] px-2 py-1 text-[12px] font-bold text-[var(--ui-ink)]">
                        {matchStatusLabel(match.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3.5">
                    <p className="flex min-w-0 flex-1 justify-end text-sm font-black"><span className="truncate">{teamA?.name ?? "TBD"}</span></p>
                    <TeamLogo team={teamA} size="h-12 w-12" plain />
                    <p className="w-16 shrink-0 text-center text-[24px] font-black tabular-nums text-[var(--ui-ink)]">{score}</p>
                    <TeamLogo team={teamB} size="h-12 w-12" plain />
                    <p className="flex min-w-0 flex-1 text-sm font-black"><span className="truncate">{teamB?.name ?? "TBD"}</span></p>
                  </div>
                  <div className="flex flex-col text-right">
                    <p className="truncate text-sm font-bold text-[var(--ui-text)]">{tournamentTypeLabel(tournament)}</p>
                    <p className="truncate text-xs font-semibold text-[var(--ui-muted)]">{stageName(stages, match.stageId)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
        );
      })}
    </div>
  );
}
