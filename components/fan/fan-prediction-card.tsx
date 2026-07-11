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
    <div className="flex flex-col gap-[14px] rounded-xl border border-black/10 bg-white px-6 py-[22px]" style={{color:"#16151b"}}>
      <div className="flex items-center justify-between"><span className="text-[13px] font-black">승부예측</span><span className="text-[11px] font-bold text-[#9c9aa3]">{total > 0 ? `${total.toLocaleString()} LP 참여 중` : "가장 먼저 예측해보세요"}</span></div>
      <div className="flex flex-col gap-[7px]"><div className="flex h-3 overflow-hidden rounded-full bg-[#eeece8]"><span style={{width:`${teamPct}%`,background:teamColor}}/></div><div className="flex justify-between text-xs font-black"><span style={{color:teamColor}}>{teamName} {teamPct}%</span><span className="text-[#9c9aa3]">{opponentName} {oppPct}%</span></div></div>
      {!votable ? <div className="rounded-full bg-[rgb(241,242,244)] py-[11px] text-center text-[13px] font-black text-[#8a8892]">{matchId ? "예측 마감" : "경기가 확정되면 열려요"}</div> : existingBet ? <button type="button" onClick={() => open(matchId!, existingBet.teamId, existingBet.teamId === teamId ? teamName : opponentName)} className="flex items-center justify-center gap-1.5 rounded-full bg-[#16151b] py-[11px] text-center text-[13px] font-black text-white"><span>내 예측 · {existingBet.teamId === teamId ? teamName : opponentName}</span><span className="text-white/60">›</span></button> : <div className="flex gap-2"><button type="button" onClick={() => open(matchId!, teamId, teamName)} disabled={pending} className="flex-1 rounded-full py-[11px] text-[13px] font-black text-white transition hover:opacity-90 disabled:opacity-70" style={{background:teamColor}}>{teamName} 승</button><button type="button" onClick={() => open(matchId!, opponentId!, opponentName)} disabled={pending} className="flex-1 rounded-full border border-[#dcdde1] py-[11px] text-[13px] font-black transition hover:bg-[rgb(242,243,245)] disabled:opacity-70" style={{color:"#16151b"}}>{opponentName} 승</button></div>}
      {matchId && showDetailsLink ? <Link href={`/matches/${matchId}`} className="text-center text-[11px] font-bold text-[#9c9aa3] transition hover:text-[#16151b]">경기 상세 보기 ›</Link> : null}
    </div>
    {modal}
  </>;
}
