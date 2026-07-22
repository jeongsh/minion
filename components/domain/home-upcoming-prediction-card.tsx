"use client";

import { TeamLogo } from "@/components/ui/team-logo";
import { usePredictionBetDialog } from "@/components/domain/prediction-bet-dialog";
import { predictionMarketForMatch, type PredictionBet } from "@/lib/predictions";
import type { Match, Team } from "@/lib/types";
import { formatDateTime } from "@/lib/view-data";

export function HomeUpcomingPredictionCard({ match, teamA, teamB, tournament, bets, currentUserId, balance }: { match: Match; teamA?: Team; teamB?: Team; tournament?: string; bets: PredictionBet[]; currentUserId?: string; balance: number | null }) {
  const { open, pending, modal } = usePredictionBetDialog({ currentUserId, balance, bets });
  const market = predictionMarketForMatch(bets, match.id, match.teamAId, match.teamBId);
  // status만 보면, 경기 시작 시각이 지났는데도 status가 아직 completed/live로 갱신되기
  // 전(동기화 지연 등)에는 예측이 계속 열려있는 것처럼 보인다. 승부예측 탭(prediction-board.tsx)과
  // 동일하게 경기 시작 시각도 함께 확인해야 마감 상태가 일치한다.
  // eslint-disable-next-line react-hooks/purity
  const closed = match.status !== "scheduled" || new Date(match.matchDate).getTime() <= Date.now();
  return <>
    <article className="min-h-[144px] rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2.5 sm:min-h-[154px] sm:p-3 dark:bg-[var(--ui-surface-muted)]">
      <div className="flex min-w-0 justify-between gap-3 text-[13px] font-semibold text-[var(--ui-muted)] sm:text-sm"><span className="min-w-0 truncate">{tournament ?? match.name}</span><span className="shrink-0">{formatDateTime(match.matchDate)}</span></div>
      <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2"><TeamLogo team={teamA} size="h-7 w-7 sm:h-8 sm:w-8" plain themeAware/><b className="min-w-0 truncate text-[13px] sm:text-base">{teamA?.shortName ?? "TBD"}</b></div>
        <span className="text-sm font-bold text-[var(--ui-muted)]">VS</span>
        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2"><b className="min-w-0 truncate text-[13px] sm:text-base">{teamB?.shortName ?? "TBD"}</b><TeamLogo team={teamB} size="h-7 w-7 sm:h-8 sm:w-8" plain themeAware/></div>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
        <span style={{width:`${market.teamAPercent}%`,background:teamA?.primaryColor||"var(--ui-ink)"}}/>
        <span className="flex-1" style={{background:teamB?.primaryColor||"var(--ui-muted)"}}/>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={!teamA || pending || closed} onClick={() => teamA && open(match.id, teamA.id, teamA.shortName)} className="min-h-10 min-w-0 rounded-lg border border-[var(--ui-border)] px-2 py-2 text-[13px] font-bold text-[var(--ui-ink)] transition hover:border-[var(--ui-ink)] hover:bg-[var(--ui-surface-muted)] disabled:opacity-50"><span className="block truncate">{teamA?.shortName ?? "TBD"} 승리 예측</span></button>
        <button type="button" disabled={!teamB || pending || closed} onClick={() => teamB && open(match.id, teamB.id, teamB.shortName)} className="min-h-10 min-w-0 rounded-lg border border-[var(--ui-border)] px-2 py-2 text-[13px] font-bold text-[var(--ui-ink)] transition hover:border-[var(--ui-ink)] hover:bg-[var(--ui-surface-muted)] disabled:opacity-50"><span className="block truncate">{teamB?.shortName ?? "TBD"} 승리 예측</span></button>
      </div>
    </article>
    {modal}
  </>;
}
