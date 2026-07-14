"use client";

import { TeamLogo } from "@/components/ui/team-logo";
import { usePredictionBetDialog } from "@/components/domain/prediction-bet-dialog";
import { predictionMarketForMatch, type PredictionBet } from "@/lib/predictions";
import type { Match, Team } from "@/lib/types";
import { formatDateTime } from "@/lib/view-data";

export function HomeUpcomingPredictionCard({ match, teamA, teamB, tournament, bets, currentUserId, balance }: { match: Match; teamA?: Team; teamB?: Team; tournament?: string; bets: PredictionBet[]; currentUserId?: string; balance: number | null }) {
  const { open, pending, modal } = usePredictionBetDialog({ currentUserId, balance, bets });
  const market = predictionMarketForMatch(bets, match.id, match.teamAId, match.teamBId);
  const closed = match.status !== "scheduled";
  return <>
    <article className="min-h-[144px] rounded-xl bg-[#fafafa] p-2.5 sm:min-h-[154px] sm:p-3 dark:border dark:border-[#e3e1e8]">
      <div className="flex min-w-0 justify-between gap-3 text-[13px] font-semibold text-[#777b82] sm:text-sm"><span className="min-w-0 truncate">{tournament ?? match.name}</span><span className="shrink-0">{formatDateTime(match.matchDate)}</span></div>
      <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2"><TeamLogo team={teamA} size="h-7 w-7 sm:h-8 sm:w-8" plain/><b className="min-w-0 truncate text-[13px] sm:text-base">{teamA?.shortName ?? "TBD"}</b></div>
        <span className="text-sm font-bold text-[#a0a3a8]">VS</span>
        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2"><b className="min-w-0 truncate text-[13px] sm:text-base">{teamB?.shortName ?? "TBD"}</b><TeamLogo team={teamB} size="h-7 w-7 sm:h-8 sm:w-8" plain/></div>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[#e4e2e8]">
        <span style={{width:`${market.teamAPercent}%`,background:teamA?.primaryColor||"#1c192b"}}/>
        <span className="flex-1" style={{background:teamB?.primaryColor||"#777080"}}/>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={!teamA || pending || closed} onClick={() => teamA && open(match.id, teamA.id, teamA.shortName)} className="min-h-10 min-w-0 rounded-lg border border-[#dcd9e2] px-2 py-2 text-[13px] font-bold hover:border-[#1c192b] hover:bg-[#f1eff5] disabled:opacity-50"><span className="block truncate">{teamA?.shortName ?? "TBD"} 승리 예측</span></button>
        <button type="button" disabled={!teamB || pending || closed} onClick={() => teamB && open(match.id, teamB.id, teamB.shortName)} className="min-h-10 min-w-0 rounded-lg border border-[#dcd9e2] px-2 py-2 text-[13px] font-bold hover:border-[#1c192b] hover:bg-[#f1eff5] disabled:opacity-50"><span className="block truncate">{teamB?.shortName ?? "TBD"} 승리 예측</span></button>
      </div>
    </article>
    {modal}
  </>;
}
