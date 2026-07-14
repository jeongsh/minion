"use client";

import Link from "next/link";

import { usePredictionBetDialog } from "@/components/domain/prediction-bet-dialog";
import { predictionMarketForMatch, type PredictionBet } from "@/lib/predictions";

export function FanPredictionCard({ matchId, teamId, teamName, opponentId, opponentName, teamColor, bets, currentUserId, balance, canVote, showDetailsLink = true }: { matchId?: string; teamId: string; teamName: string; opponentId?: string; opponentName: string; teamColor: string; bets: PredictionBet[]; currentUserId?: string; balance: number | null; canVote: boolean; showDetailsLink?: boolean }) {
  const { open, pending, modal } = usePredictionBetDialog({ currentUserId, balance, bets });
  const market = matchId && opponentId ? predictionMarketForMatch(bets, matchId, teamId, opponentId) : null;
  const teamPct = market?.teamAPercent ?? 0;
  const oppPct = market?.teamBPercent ?? 0;
  const total = market?.totalStake ?? 0;
  const existingBet = currentUserId && matchId ? bets.find((bet) => bet.userId === currentUserId && bet.matchId === matchId && bet.status === "open") : undefined;
  const votable = canVote && !!matchId && !!opponentId;

  return <>
    <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-black/10 bg-white px-3 py-3 sm:gap-[14px] sm:px-6 sm:py-[22px]" style={{color:"#16151b"}}>
      <div className="flex min-w-0 items-center justify-between gap-3"><span className="shrink-0 text-[13px] font-medium">승부예측</span><span className="min-w-0 truncate text-right text-[12px] font-medium text-[#9c9aa3] sm:text-[13px]">{total > 0 ? `${total.toLocaleString()} LP 참여 중` : "가장 먼저 예측해보세요"}</span></div>
      <div className="flex flex-col gap-[7px]"><div className="flex h-2.5 overflow-hidden rounded-full bg-[#eeece8] sm:h-3"><span style={{width:`${teamPct}%`,background:teamColor}}/></div><div className="flex min-w-0 justify-between gap-3 text-[12px] font-black sm:text-[13px]"><span className="min-w-0 truncate" style={{color:teamColor}}>{teamName} {teamPct}%</span><span className="min-w-0 truncate text-right text-[#9c9aa3]">{opponentName} {oppPct}%</span></div></div>
      {!votable ? <div className="min-h-10 rounded-full bg-[rgb(241,242,244)] px-3 py-2.5 text-center text-[13px] font-black text-[#8a8892] sm:min-h-11 sm:py-[11px]">{matchId ? "예측 마감" : "경기가 확정되면 열려요"}</div> : existingBet ? <button type="button" onClick={() => open(matchId!, existingBet.teamId, existingBet.teamId === teamId ? teamName : opponentName)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#16151b] px-3 py-2.5 text-center text-[13px] font-black text-white sm:min-h-11 sm:py-[11px]"><span className="min-w-0 truncate">내 예측 · {existingBet.teamId === teamId ? teamName : opponentName}</span><span className="shrink-0 text-white/60">›</span></button> : <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => open(matchId!, teamId, teamName)} disabled={pending} className="min-h-10 min-w-0 rounded-full px-3 py-2.5 text-[13px] font-black text-white transition hover:opacity-90 disabled:opacity-70 sm:min-h-11 sm:py-[11px]" style={{background:teamColor}}><span className="block truncate">{teamName} 승</span></button><button type="button" onClick={() => open(matchId!, opponentId!, opponentName)} disabled={pending} className="min-h-10 min-w-0 rounded-full border border-[#dcdde1] px-3 py-2.5 text-[13px] font-black transition hover:bg-[rgb(242,243,245)] disabled:opacity-70 sm:min-h-11 sm:py-[11px]" style={{color:"#16151b"}}><span className="block truncate">{opponentName} 승</span></button></div>}
      {matchId && showDetailsLink ? <Link href={`/matches/${matchId}`} className="text-center text-[13px] font-bold text-[#9c9aa3] transition hover:text-[#16151b]">경기 상세 보기 ›</Link> : null}
    </div>
    {modal}
  </>;
}
