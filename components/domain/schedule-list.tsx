"use client";

import { EyeOff } from "lucide-react";
import Link from "next/link";

import { ScheduleTodayScroll } from "@/components/domain/schedule-today-scroll";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";
import { TeamLogo } from "@/components/ui/team-logo";
import { useSpoilerFree } from "@/lib/spoiler-free/spoiler-free-context";
import { isMatchFinished, isMatchLive, matchStatusLabel, stageName, tournamentTypeLabel } from "@/lib/match-display";
import type { Match, Stage, Team, Tournament } from "@/lib/types";
import { dateKeyKST, formatTimeKST, KST_TIMEZONE, matchHref } from "@/lib/view-data";

const DAY_SECTION_PREFIX = "schedule-day";

function dateHeading(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(value));
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
  const { enabled: spoilerFreeEnabled, isRevealed, reveal } = useSpoilerFree();

  const groups = matches.reduce<Record<string, Match[]>>((result, match) => {
    const key = dateHeading(match.matchDate);
    return { ...result, [key]: [...(result[key] ?? []), match] };
  }, {});

  if (matches.length === 0) {
    return (
      <KitschEmptyState
        character="marker"
        title="이 조건엔 경기가 없어요"
        body={emptyMessage || "날짜나 대회를 살짝 바꿔볼까요?"}
        animated
      />
    );
  }

  const todayKey = dateKeyKST(new Date());
  const entries = Object.entries(groups); // matchDate 오름차순 정렬 유지
  // 스크롤 대상: 오늘 → 없으면 오늘 이후 가장 가까운 날 → 없으면 마지막(가장 최근) 날
  const scrollTargetDateKey =
    entries.find(([, day]) => dateKeyKST(day[0].matchDate) >= todayKey)?.[0] ??
    entries[entries.length - 1]?.[0];

  return (
    <div className="flex flex-col gap-8 pb-1">
      {scrollTargetDateKey && <ScheduleTodayScroll targetId={`${DAY_SECTION_PREFIX}-${dateKeyKST(groups[scrollTargetDateKey][0].matchDate)}`} />}
      {entries.map(([date, dayMatches]) => {
        const dateKey = dateKeyKST(dayMatches[0].matchDate);
        const isToday = dateKeyKST(dayMatches[0].matchDate) === todayKey;

        return (
        <section key={date} id={`${DAY_SECTION_PREFIX}-${dateKey}`} className="scroll-mt-48 md:scroll-mt-40">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-[var(--ui-ink)]">
            {date}
            {isToday && <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[13px] font-medium text-[var(--accent-foreground)]">오늘</span>}
          </h2>
          <div className={`overflow-hidden rounded-2xl border bg-[var(--ui-surface)] ${isToday ? "border-2 border-[var(--accent)]" : "border-[var(--ui-border)]"}`}>
            {dayMatches.map((match) => {
              const teamA = teams.find((team) => team.id === match.teamAId);
              const teamB = teams.find((team) => team.id === match.teamBId);
              const tournament = tournaments.find((item) => item.id === match.tournamentId);
              const completed = match.status === "completed";
              const live = isMatchLive(match);
              const spoiled = spoilerFreeEnabled && isMatchFinished(match) && !isRevealed(match.id);
              const score = match.teamAScore === null || match.teamBScore === null
                ? "VS"
                : `${match.teamAScore} : ${match.teamBScore}`;
              const winnerId = spoiled ? null : match.winnerTeamId ??
                (completed && match.teamAScore !== null && match.teamBScore !== null
                  ? match.teamAScore > match.teamBScore
                    ? match.teamAId
                    : match.teamBScore > match.teamAScore
                      ? match.teamBId
                      : null
                  : null);
              const teamNameClass = (teamId?: string) =>
                `min-w-0 truncate font-black ${
                  !spoiled && completed && winnerId ? (teamId === winnerId ? "text-[var(--ui-ink)]" : "text-[var(--ui-muted)]") : "text-[var(--ui-ink)]"
                }`;
              const teamALabel = teamA?.shortName || teamA?.name || "TBD";
              const teamBLabel = teamB?.shortName || teamB?.name || "TBD";

              return (
                <Link
                  href={matchHref(match)}
                  key={match.id}
                  data-navigation-ignore={spoiled ? "true" : undefined}
                  onClick={(event) => {
                    if (!spoiled) return;
                    event.preventDefault();
                    reveal(match.id);
                  }}
                  className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-2.5 border-b border-[var(--ui-border)] px-3 py-3 transition-colors last:border-b-0 hover:bg-[var(--ui-card-hover)] md:grid-cols-[140px_minmax(0,1fr)_160px] md:gap-4 md:px-5 md:py-4"
                >
                  <div className="flex flex-col items-start gap-1">
                    <time className="text-[14px] font-black tabular-nums tracking-tight text-[var(--ui-ink)] md:text-base">{formatTimeKST(match.matchDate)}</time>
                    {live ? (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-500 md:px-2 md:py-1 md:text-[13px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 motion-safe:animate-pulse" />
                        LIVE
                      </span>
                    ) : (
                      <span className="w-fit rounded-full bg-[var(--ui-card-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ui-muted)] md:px-2 md:py-1 md:text-[13px]">
                        {matchStatusLabel(match.status)}
                      </span>
                    )}
                  </div>
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-center gap-1 sm:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] sm:gap-2 md:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] md:gap-3.5">
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 md:gap-2.5">
                      <p className={`${teamNameClass(match.teamAId)} text-right text-[15px]`} title={teamA?.name ?? "TBD"}>{teamALabel}</p>
                      <TeamLogo team={teamA} size="h-8 w-8 shrink-0 sm:h-9 sm:w-9 md:h-11 md:w-11" plain themeAware />
                    </div>
                    {spoiled ? (
                      <span
                        className="flex shrink-0 items-center justify-center text-[var(--ui-muted)]"
                        title="탭하여 결과 보기"
                        aria-label="결과가 가려져 있습니다. 탭하여 보기"
                      >
                        <EyeOff size={18} strokeWidth={1.8} />
                      </span>
                    ) : (
                      <p className="shrink-0 text-center text-[15px] font-black tabular-nums text-[var(--ui-ink)] sm:text-base md:text-xl">{score}</p>
                    )}
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 md:gap-2.5">
                      <TeamLogo team={teamB} size="h-8 w-8 shrink-0 sm:h-9 sm:w-9 md:h-11 md:w-11" plain themeAware />
                      <p className={`${teamNameClass(match.teamBId)} text-[15px]`} title={teamB?.name ?? "TBD"}>{teamBLabel}</p>
                    </div>
                  </div>
                  <div className="hidden items-center justify-between gap-2 md:flex md:flex-col md:items-end md:justify-center md:gap-0.5">
                    <p className="truncate text-sm font-bold text-[var(--ui-text)]">{tournamentTypeLabel(tournament)}</p>
                    <p className="truncate text-[13px] font-semibold text-[var(--ui-muted)]">{stageName(stages, match.stageId)}</p>
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
