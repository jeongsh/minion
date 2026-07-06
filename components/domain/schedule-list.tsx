import Link from "next/link";

import { ScheduleTodayScroll } from "@/components/domain/schedule-today-scroll";
import { TeamLogo } from "@/components/ui/team-logo";
import { isMatchLive, matchStatusLabel, stageName, tournamentTypeLabel } from "@/lib/match-display";
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
              const completed = match.status === "completed";
              const live = isMatchLive(match);
              const score = match.teamAScore === null || match.teamBScore === null
                ? "VS"
                : `${match.teamAScore} : ${match.teamBScore}`;
              const winnerId = match.winnerTeamId ??
                (completed && match.teamAScore !== null && match.teamBScore !== null
                  ? match.teamAScore > match.teamBScore
                    ? match.teamAId
                    : match.teamBScore > match.teamAScore
                      ? match.teamBId
                      : null
                  : null);
              const teamNameClass = (teamId?: string) =>
                `min-w-0 truncate text-[15px] font-black ${
                  completed && winnerId ? (teamId === winnerId ? "text-[var(--ui-ink)]" : "text-[var(--ui-muted)]") : "text-[var(--ui-ink)]"
                }`;

              return (
                <Link
                  href={matchHref(match)}
                  key={match.id}
                  className="flex flex-col gap-3 border-b border-[var(--ui-border)] px-4 py-4 transition-colors last:border-b-0 hover:bg-[var(--ui-surface-muted)] md:grid md:grid-cols-[140px_minmax(0,1fr)_160px] md:items-center md:gap-4 md:px-5"
                >
                  <div className="flex items-center gap-2 md:flex-col md:items-start md:gap-1.5">
                    <time className="text-base font-black tabular-nums tracking-tight text-[var(--ui-ink)]">{formatTimeKST(match.matchDate)}</time>
                    {live ? (
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-1 text-[11px] font-bold text-red-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 motion-safe:animate-pulse" />
                        LIVE
                      </span>
                    ) : (
                      <span className="w-fit rounded-full bg-[var(--ui-surface-muted)] px-2 py-1 text-[12px] font-bold text-[var(--ui-muted)]">
                        {matchStatusLabel(match.status)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2.5 sm:gap-3.5">
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
                      <p className={`${teamNameClass(match.teamAId)} text-right`}>{teamA?.name ?? "TBD"}</p>
                      <TeamLogo team={teamA} size="h-11 w-11 shrink-0" plain />
                    </div>
                    <p className="w-16 shrink-0 text-center text-[20px] font-black tabular-nums text-[var(--ui-ink)]">{score}</p>
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <TeamLogo team={teamB} size="h-11 w-11 shrink-0" plain />
                      <p className={teamNameClass(match.teamBId)}>{teamB?.name ?? "TBD"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 md:flex-col md:items-end md:justify-center md:gap-0.5">
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
