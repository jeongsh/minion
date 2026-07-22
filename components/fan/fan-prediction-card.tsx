"use client";

import Link from "next/link";
import { TicketCheck } from "lucide-react";

import { usePredictionBetDialog } from "@/components/domain/prediction-bet-dialog";
import { predictionMarketForMatch, type PredictionBet } from "@/lib/predictions";

export function FanPredictionCard({ matchId, teamId, teamName, opponentId, opponentName, teamColor, bets, currentUserId, balance, canVote, showDetailsLink = true, glass = false }: { matchId?: string; teamId: string; teamName: string; opponentId?: string; opponentName: string; teamColor: string; bets: PredictionBet[]; currentUserId?: string; balance: number | null; canVote: boolean; showDetailsLink?: boolean; glass?: boolean }) {
  const { open, pending, modal } = usePredictionBetDialog({ currentUserId, balance, bets });
  const market = matchId && opponentId ? predictionMarketForMatch(bets, matchId, teamId, opponentId) : null;
  const teamPct = market?.teamAPercent ?? 0;
  const oppPct = market?.teamBPercent ?? 0;
  const total = market?.totalStake ?? 0;
  const existingBet = currentUserId && matchId ? bets.find((bet) => bet.userId === currentUserId && bet.matchId === matchId && bet.status === "open") : undefined;
  const votable = canVote && !!matchId && !!opponentId;

  // glass: 사진 헤더 위에 얹힐 때. 흰 반투명 + 블러라 배경 사진이 비쳐 보인다.
  const shell = glass
    ? "border-white/25 bg-white/10 backdrop-blur-xl"
    : "border-black/10 bg-white";
  const muted = glass ? "text-white/65" : "text-[#9c9aa3]";
  const track = glass ? "bg-white/20" : "bg-[#eeece8]";

  return <>
    <div
      className={`fan-prediction-ticket flex min-w-0 flex-col gap-2.5 rounded-xl border-2 px-3 py-3 sm:gap-[14px] sm:px-6 sm:py-[22px] ${shell}`}
      style={{
        color: glass ? undefined : "#16151b",
        borderColor: teamColor,
        ["--fan-ticket-color" as string]: teamColor,
      }}
    >
      <div className="fan-prediction-ticket__head flex min-w-0 items-center justify-between gap-3 border-b border-dashed pb-2.5" style={{ borderColor: teamColor }}><span className={`inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold ${glass ? "text-white" : ""}`}><TicketCheck size={16} strokeWidth={2.6} style={{ color: teamColor }} aria-hidden="true" />승부예측 티켓</span><span className={`min-w-0 truncate text-right text-[12px] font-medium sm:text-[13px] ${muted}`}>{total > 0 ? `${total.toLocaleString()} LP 참여 중` : "가장 먼저 예측해보세요"}</span></div>
      <div className="flex flex-col gap-[7px]"><div className={`flex h-2.5 overflow-hidden rounded-full sm:h-3 ${track}`}><span style={{width:`${teamPct}%`,background:teamColor}}/></div><div className="flex min-w-0 justify-between gap-3 text-[12px] font-black sm:text-[13px]"><span className="min-w-0 truncate" style={{color:teamColor}}>{teamName} {teamPct}%</span><span className={`min-w-0 truncate text-right ${muted}`}>{opponentName} {oppPct}%</span></div></div>
      {!votable ? <div className={`min-h-10 rounded-full px-3 py-2.5 text-center text-[13px] font-black sm:min-h-11 sm:py-[11px] ${glass ? "bg-white/10 text-white/70" : "bg-[rgb(241,242,244)] text-[#8a8892]"}`}>{matchId ? "예측 마감" : "경기가 확정되면 열려요"}</div> : existingBet ? <button type="button" onClick={() => open(matchId!, existingBet.teamId, existingBet.teamId === teamId ? teamName : opponentName)} className={`flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-center text-[13px] font-black text-white sm:min-h-11 sm:py-[11px] ${glass ? "bg-white/20 backdrop-blur-sm" : "bg-[#16151b]"}`}><span className="min-w-0 truncate">내 예측 · {existingBet.teamId === teamId ? teamName : opponentName}</span><span className="shrink-0 text-white/60">›</span></button> : <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => open(matchId!, teamId, teamName)} disabled={pending} className="min-h-10 min-w-0 rounded-full px-3 py-2.5 text-[13px] font-black text-white transition hover:opacity-90 disabled:opacity-70 sm:min-h-11 sm:py-[11px]" style={{background:teamColor}}><span className="block truncate">{teamName} 승</span></button><button type="button" onClick={() => open(matchId!, opponentId!, opponentName)} disabled={pending} className={`min-h-10 min-w-0 rounded-full border px-3 py-2.5 text-[13px] font-black transition disabled:opacity-70 sm:min-h-11 sm:py-[11px] ${glass ? "border-white/30 text-white hover:bg-white/15" : "border-[#dcdde1] hover:bg-[rgb(242,243,245)]"}`} style={glass ? undefined : {color:"#16151b"}}><span className="block truncate">{opponentName} 승</span></button></div>}
      {matchId && showDetailsLink ? <Link href={`/matches/${matchId}`} className={`text-center text-[13px] font-bold transition ${glass ? "text-white/65 hover:text-white" : "text-[#9c9aa3] hover:text-[#16151b]"}`}>경기 상세 보기 ›</Link> : null}
    </div>
    {modal}
  </>;
}
