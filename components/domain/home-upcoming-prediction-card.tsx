"use client";

import { TeamLogo } from "@/components/ui/team-logo";
import { usePredictionBetDialog } from "@/components/domain/prediction-bet-dialog";
import type { PredictionBet } from "@/lib/predictions";
import type { Match, Team } from "@/lib/types";
import { formatDateTime } from "@/lib/view-data";

export function HomeUpcomingPredictionCard({ match, teamA, teamB, tournament, bets, currentUserId, balance }: { match: Match; teamA?: Team; teamB?: Team; tournament?: string; bets: PredictionBet[]; currentUserId?: string; balance: number | null }) {
  const { open, pending, modal } = usePredictionBetDialog({ currentUserId, balance, bets });
  return <>
    <article className="h-[154px] overflow-hidden rounded-xl bg-[#fafafa] p-3 dark:border dark:border-[#e3e1e8]">
      <div className="flex justify-between text-xs font-semibold text-[#777b82]"><span>{tournament ?? match.name}</span><span>{formatDateTime(match.matchDate)}</span></div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-2"><TeamLogo team={teamA} size="h-8 w-8" plain/><b>{teamA?.shortName ?? "TBD"}</b></div>
        <span className="text-xs font-black text-[#a0a3a8]">VS</span>
        <div className="flex items-center justify-end gap-2"><b>{teamB?.shortName ?? "TBD"}</b><TeamLogo team={teamB} size="h-8 w-8" plain/></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={!teamA || pending} onClick={() => teamA && open(match.id, teamA.id, teamA.shortName)} className="w-full rounded-lg border border-[#dcd9e2] py-2 text-xs font-black hover:border-[#1c192b] hover:bg-[#f1eff5] disabled:opacity-50">{teamA?.shortName ?? "TBD"} 승리 예측</button>
        <button type="button" disabled={!teamB || pending} onClick={() => teamB && open(match.id, teamB.id, teamB.shortName)} className="w-full rounded-lg border border-[#dcd9e2] py-2 text-xs font-black hover:border-[#1c192b] hover:bg-[#f1eff5] disabled:opacity-50">{teamB?.shortName ?? "TBD"} 승리 예측</button>
      </div>
    </article>
    {modal}
  </>;
}
