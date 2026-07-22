"use client";

import Link from "next/link";
import { TeamLogo } from "@/components/ui/team-logo";
import { usePredictionBetDialog } from "@/components/domain/prediction-bet-dialog";
import { isMatchLive } from "@/lib/match-display";
import { predictionMarketForMatch, type PredictionBet } from "@/lib/predictions";
import type { Match, Team } from "@/lib/types";
import { formatDateTime, matchHref } from "@/lib/view-data";

export type HomeMatchItem = {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  tournament?: string;
  bets: PredictionBet[];
};

/**
 * 홈 매치 카드. 예전에는 "오늘의 매치"(예측 분포 + 매치정보/평점 링크)와
 * "다가오는 매치"(베팅 버튼) 두 종류였는데, 오늘 예정 경기가 양쪽 목록에 모두
 * 들어가 같은 경기가 한 화면에 두 번 그려졌다. 카드를 하나로 합치고
 * 예측 분포 막대는 공통으로 두되, 액션만 경기 상태에 따라 바꾼다.
 */
export function HomeMatchCard({
  match,
  teamA,
  teamB,
  tournament,
  bets,
  currentUserId,
  balance,
}: HomeMatchItem & { currentUserId?: string; balance: number | null }) {
  const { open, pending, modal } = usePredictionBetDialog({ currentUserId, balance, bets });
  const market = predictionMarketForMatch(bets, match.id, match.teamAId, match.teamBId);
  const live = isMatchLive(match);
  // status만 보면 경기 시작 시각이 지났는데도 동기화 지연으로 scheduled가 남아있는 동안
  // 예측이 열려있는 것처럼 보인다. 승부예측 탭과 동일하게 시작 시각도 함께 본다.
  // eslint-disable-next-line react-hooks/purity
  const bettingClosed = match.status !== "scheduled" || new Date(match.matchDate).getTime() <= Date.now();
  const scheduled = match.status === "scheduled" && !live;

  return (
    <>
      <article className="flex h-full min-w-0 flex-col rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 lg:p-4 dark:bg-[var(--ui-surface-muted)]">
        <div className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-[var(--ui-muted)]">
          {live ? (
            <span className="shrink-0 rounded-full bg-[#ff3158] px-2 py-1 text-white">LIVE</span>
          ) : (
            <span className="min-w-0 truncate">{tournament ?? match.name}</span>
          )}
          <span className="ml-auto shrink-0">{formatDateTime(match.matchDate)}</span>
        </div>

        <Link
          href={matchHref(match)}
          className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 xl:mt-4 xl:gap-4"
        >
          <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-3">
            <TeamLogo team={teamA} size="h-9 w-9 lg:h-11 lg:w-11 xl:h-12 xl:w-12" plain />
            <b className="min-w-0 truncate text-sm lg:text-base">{teamA?.shortName ?? "TBD"}</b>
          </div>
          <strong className="shrink-0 text-lg xl:text-xl">
            {scheduled ? "VS" : `${match.teamAScore ?? 0} : ${match.teamBScore ?? 0}`}
          </strong>
          <div className="flex min-w-0 flex-row-reverse items-center justify-center gap-2 sm:gap-3">
            <TeamLogo team={teamB} size="h-9 w-9 lg:h-11 lg:w-11 xl:h-12 xl:w-12" plain />
            <b className="min-w-0 truncate text-sm lg:text-base">{teamB?.shortName ?? "TBD"}</b>
          </div>
        </Link>

        <div className="home-prediction-score mt-3">
          <div className="flex justify-between text-[13px] font-black">
            <span>{teamA?.shortName ?? "TBD"} {market.teamAPercent}%</span>
            <span>{market.teamBPercent}% {teamB?.shortName ?? "TBD"}</span>
          </div>
          <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
            <span style={{ width: `${market.teamAPercent}%`, background: teamA?.primaryColor || "var(--ui-ink)" }} />
            <span className="flex-1" style={{ background: teamB?.primaryColor || "var(--ui-muted)" }} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {bettingClosed ? (
            <>
              <Link
                href={matchHref(match)}
                className="min-h-10 rounded-lg bg-[var(--ui-surface-muted)] px-2 py-2 text-center text-[13px] font-black leading-6 text-[var(--ui-ink)] transition hover:bg-[color-mix(in_srgb,var(--ui-surface-muted)_86%,var(--ui-ink))]"
              >
                매치정보 보기
              </Link>
              <Link
                href={`${matchHref(match)}?tab=rating`}
                className="min-h-10 rounded-lg bg-[var(--ui-ink)] px-2 py-2 text-center text-[13px] font-black leading-6 text-[var(--ui-surface)] transition hover:opacity-90"
              >
                평점 보기
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!teamA || pending}
                onClick={() => teamA && open(match.id, teamA.id, teamA.shortName)}
                className="min-h-10 min-w-0 rounded-lg border border-[var(--ui-border)] px-2 py-2 text-[13px] font-bold text-[var(--ui-ink)] transition hover:border-[var(--ui-ink)] hover:bg-[var(--ui-surface-muted)] disabled:opacity-50"
              >
                <span className="block truncate">{teamA?.shortName ?? "TBD"} 승리 예측</span>
              </button>
              <button
                type="button"
                disabled={!teamB || pending}
                onClick={() => teamB && open(match.id, teamB.id, teamB.shortName)}
                className="min-h-10 min-w-0 rounded-lg border border-[var(--ui-border)] px-2 py-2 text-[13px] font-bold text-[var(--ui-ink)] transition hover:border-[var(--ui-ink)] hover:bg-[var(--ui-surface-muted)] disabled:opacity-50"
              >
                <span className="block truncate">{teamB?.shortName ?? "TBD"} 승리 예측</span>
              </button>
            </>
          )}
        </div>
      </article>
      {modal}
    </>
  );
}
