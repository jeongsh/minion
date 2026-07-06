import Link from "next/link";

import { ScheduleTodayScroll } from "@/components/domain/schedule-today-scroll";
import { TeamLogo } from "@/components/ui/team-logo";
import { getFanMatchPredictions } from "@/lib/data/lck";
import { isMatchLive, matchStatusLabel, stageName, tournamentTypeLabel } from "@/lib/match-display";
import type { FanMatchPrediction, Match, Stage, Team, Tournament } from "@/lib/types";
import { formatTimeKST, KST_TIMEZONE, matchHref } from "@/lib/view-data";

const TODAY_SECTION_ID = "schedule-today";
// 한 줄에 보여줄 최대 매치 카드 수. 하루치가 이보다 적으면 다음 날짜를 끌어와 채운다.
const MAX_PER_ROW = 4;

/** KST 기준 YYYY-MM-DD 키 (오늘 날짜 비교·날짜 그룹핑용) */
function dateKeyKST(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

/** 카드에 표시할 짧은 날짜 (예: 7/1). 한 줄에 날짜가 섞여도 카드만 보고 구분할 수 있도록. */
function shortDate(value: string) {
  const date = new Date(value);
  const month = new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, month: "numeric" }).format(date);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, day: "numeric" }).format(date);
  return `${month}/${day}`;
}

/** 원래 일정 페이지의 날짜 제목 형식 (예: 7월 6일 월요일). YYYY-MM-DD 키에서 직접 만든다. */
function dateHeadingFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

/**
 * 날짜별로 묶되, 하루치를 억지로 쪼개지 않고 한 줄(최대 MAX_PER_ROW개)에 채운다.
 * 다음 날짜를 통째로 넣으면 초과되는 경우엔 그 날짜를 다음 줄로 넘긴다.
 * (하루치 경기 수가 MAX_PER_ROW보다 많으면 그 날짜만으로 줄을 채워 나간다.)
 */
function packMatchesIntoRows(matches: Match[]): Match[][] {
  const dayGroups = new Map<string, Match[]>();
  for (const match of matches) {
    const key = dateKeyKST(match.matchDate);
    dayGroups.set(key, [...(dayGroups.get(key) ?? []), match]);
  }

  const rows: Match[][] = [];
  let current: Match[] = [];

  for (const dayMatches of dayGroups.values()) {
    if (current.length > 0 && current.length + dayMatches.length > MAX_PER_ROW) {
      rows.push(current);
      current = [];
    }

    let i = 0;
    while (i < dayMatches.length) {
      const space = MAX_PER_ROW - current.length;
      const chunk = dayMatches.slice(i, i + space);
      current.push(...chunk);
      i += chunk.length;
      if (current.length === MAX_PER_ROW) {
        rows.push(current);
        current = [];
      }
    }
  }
  if (current.length > 0) rows.push(current);

  return rows;
}

/** 메인페이지 매치 카드와 동일한 톤의 팬 예측 비율 바(투표 UI 없이 결과만 표시). */
function PredictionBar({ teamA, teamB, predictions }: { teamA?: Team; teamB?: Team; predictions: FanMatchPrediction[] }) {
  const av = predictions.filter((p) => p.teamId === teamA?.id).length;
  const bv = predictions.filter((p) => p.teamId === teamB?.id).length;
  const total = av + bv;
  const ap = total ? Math.round((av / total) * 100) : 50;

  return (
    <div className="mt-3 w-full">
      <div className="flex justify-between text-[10px] font-black text-[var(--ui-ink)]">
        <span>{ap}%</span>
        <span>{100 - ap}%</span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
        <span className="block h-full" style={{ width: `${ap}%`, background: teamA?.primaryColor || "var(--ui-ink)" }} />
        <span className="block h-full flex-1" style={{ background: teamB?.primaryColor || "var(--ui-muted)" }} />
      </div>
    </div>
  );
}

export async function ScheduleListRenewal({
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
  if (matches.length === 0) {
    return <p className="rounded-2xl bg-[var(--ui-surface-muted)] py-16 text-center text-sm text-[var(--ui-muted)]">{emptyMessage}</p>;
  }

  // 예측 비율 바 표시용 — 카드 디자인이 메인페이지 매치 카드와 동일한 톤을 쓰기 위해 이 컴포넌트 안에서 직접 가져온다.
  const allPredictions = await getFanMatchPredictions();
  const predictionsByMatchId = new Map<string, FanMatchPrediction[]>();
  for (const prediction of allPredictions) {
    predictionsByMatchId.set(prediction.matchId, [...(predictionsByMatchId.get(prediction.matchId) ?? []), prediction]);
  }

  const rows = packMatchesIntoRows(matches); // matchDate 오름차순 정렬 유지
  const todayKey = dateKeyKST(new Date());
  // 스크롤 대상: 오늘 경기가 포함된 줄 → 없으면 오늘 이후 가장 가까운 줄 → 없으면 마지막(가장 최근) 줄
  const scrollRowIndex = rows.findIndex((row) => row.some((match) => dateKeyKST(match.matchDate) >= todayKey));
  const scrollTargetIndex = scrollRowIndex === -1 ? rows.length - 1 : scrollRowIndex;

  return (
    <div className="flex flex-col gap-8 pb-1">
      <ScheduleTodayScroll targetId={TODAY_SECTION_ID} />
      {rows.map((rowMatches, rowIndex) => {
        // 같은 날짜끼리 연속으로 묶어서, 날짜 제목을 그 날짜의 카드들 바로 위에만 걸치게 한다.
        // 날짜가 바뀌는 경계에는 세로 가운데 정렬된 "·" 구분자를 위한 좁은 칼럼을 끼워 넣는다.
        const dateGroups: { key: string; count: number; startCol: number }[] = [];
        const cardCols: number[] = [];
        const dividerCols: number[] = [];
        const templateParts: string[] = [];
        {
          let col = 1;
          let prevKey: string | null = null;
          for (const match of rowMatches) {
            const key = dateKeyKST(match.matchDate);
            const last = dateGroups[dateGroups.length - 1];
            if (prevKey !== null && key !== prevKey) {
              dividerCols.push(col);
              templateParts.push("24px");
              col += 1;
            }
            if (last && key === prevKey) {
              last.count += 1;
            } else {
              dateGroups.push({ key, count: 1, startCol: col });
            }
            cardCols.push(col);
            templateParts.push("260px");
            col += 1;
            prevKey = key;
          }
        }

        return (
        <section
          key={rowMatches[0].id}
          id={rowIndex === scrollTargetIndex ? TODAY_SECTION_ID : undefined}
          className="scroll-mt-40"
        >
          <div className="grid gap-4" style={{ gridTemplateColumns: templateParts.join(" ") }}>
            {dateGroups.map((group) => (
              <div
                key={group.key}
                style={{ gridColumn: `${group.startCol} / span ${group.count}`, gridRow: 1 }}
                className="mb-3 flex items-center gap-2"
              >
                <h2 className="home-section-title truncate text-[20px] text-[var(--ui-ink)]">{dateHeadingFromKey(group.key)}</h2>
                {group.key === todayKey && <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-foreground)]">오늘</span>}
              </div>
            ))}
            {dividerCols.map((col) => (
              <span
                key={`divider-${col}`}
                style={{ gridColumn: col, gridRow: 2 }}
                className="flex items-center justify-center text-lg font-black text-[var(--ui-muted)]"
              >
                ·
              </span>
            ))}
          {rowMatches.map((match, matchIndex) => {
            const teamA = teams.find((team) => team.id === match.teamAId);
            const teamB = teams.find((team) => team.id === match.teamBId);
            const tournament = tournaments.find((item) => item.id === match.tournamentId);
            const completed = match.status === "completed";
            const live = isMatchLive(match);
            const isToday = dateKeyKST(match.matchDate) === todayKey;
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
              `w-full truncate text-[13px] font-black ${
                completed && winnerId ? (teamId === winnerId ? "text-[var(--ui-ink)]" : "text-[var(--ui-muted)]") : "text-[var(--ui-ink)]"
              }`;

            return (
              <article
                key={match.id}
                style={{ gridColumn: cardCols[matchIndex], gridRow: 2 }}
                className={`flex w-[260px] flex-col items-center gap-1.5 rounded-2xl border px-3 py-5 text-center transition-colors hover:border-[var(--ui-ink)]/30 ${
                  isToday && live ? "border-2 border-red-500/50" : "border-[var(--ui-border)]"
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <time className="text-xs font-black tabular-nums text-[var(--ui-ink)]">
                    {shortDate(match.matchDate)} {formatTimeKST(match.matchDate)}
                  </time>
                  {live ? (
                    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-500">
                      <span className="h-1 w-1 rounded-full bg-red-500 motion-safe:animate-pulse" />
                      LIVE
                    </span>
                  ) : (
                    <span className="w-fit rounded-full bg-[var(--ui-surface-muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ui-muted)]">
                      {matchStatusLabel(match.status)}
                    </span>
                  )}
                </div>
                <p className="truncate text-[10px] font-semibold text-[var(--ui-muted)]">
                  {tournamentTypeLabel(tournament)} · {stageName(stages, match.stageId)}
                </p>

                <Link href={matchHref(match)} className="mt-3 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1">
                  <div className="flex min-w-0 flex-col items-center gap-1.5">
                    <TeamLogo team={teamA} size="h-14 w-14 shrink-0" plain />
                    <p className={teamNameClass(match.teamAId)}>{teamA?.shortName ?? "TBD"}</p>
                  </div>
                  <p className="shrink-0 text-sm font-black tabular-nums text-[var(--ui-ink)]">{score}</p>
                  <div className="flex min-w-0 flex-col items-center gap-1.5">
                    <TeamLogo team={teamB} size="h-14 w-14 shrink-0" plain />
                    <p className={teamNameClass(match.teamBId)}>{teamB?.shortName ?? "TBD"}</p>
                  </div>
                </Link>

                <PredictionBar teamA={teamA} teamB={teamB} predictions={predictionsByMatchId?.get(match.id) ?? []} />

                <div className="mt-3 grid w-full grid-cols-2 gap-1.5">
                  <Link
                    href={matchHref(match)}
                    className="rounded-lg bg-[var(--ui-surface-muted)] py-2 text-center text-xs font-black text-[var(--ui-ink)] transition-opacity hover:opacity-80"
                  >
                    매치
                  </Link>
                  <Link
                    href={`${matchHref(match)}?tab=rating`}
                    className="rounded-lg bg-[var(--ui-ink)] py-2 text-center text-xs font-black text-[var(--ui-surface)] transition-opacity hover:opacity-85"
                  >
                    평점
                  </Link>
                </div>
              </article>
            );
          })}
          </div>
        </section>
        );
      })}
    </div>
  );
}
