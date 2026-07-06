"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { predictMatchWinnerAction } from "@/app/matches/[matchId]/actions";

// 팬 승부예측 — fan_match_predictions 집계에 실제 반영한다. 쿠키 voterKey로
// 재방문 시 내 예측/집계가 유지된다.
export function FanPredictionCard({
  matchId,
  teamId,
  teamName,
  opponentId,
  opponentName,
  teamColor,
  initialTeamVotes,
  initialOpponentVotes,
  initialMyVote,
  canVote,
  showDetailsLink = true,
}: {
  matchId?: string;
  teamId: string;
  teamName: string;
  opponentId?: string;
  opponentName: string;
  teamColor: string;
  initialTeamVotes: number;
  initialOpponentVotes: number;
  initialMyVote?: string;
  canVote: boolean;
  showDetailsLink?: boolean;
}) {
  const router = useRouter();
  const [teamVotes, setTeamVotes] = useState(initialTeamVotes);
  const [oppVotes, setOppVotes] = useState(initialOpponentVotes);
  const [myVote, setMyVote] = useState<string | undefined>(initialMyVote);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = teamVotes + oppVotes;
  const teamPct = total > 0 ? Math.round((teamVotes / total) * 100) : 0;
  const oppPct = total > 0 ? 100 - teamPct : 0;
  const votable = canVote && !!matchId && !!opponentId;

  function vote(choiceId: string) {
    if (!matchId || !votable || isPending) return;

    const previous = myVote;
    // 낙관적 반영: 기존 표 회수 후 새 표 반영.
    setMyVote(choiceId);
    if (previous !== choiceId) {
      if (previous === teamId) setTeamVotes((v) => Math.max(0, v - 1));
      if (previous === opponentId) setOppVotes((v) => Math.max(0, v - 1));
      if (choiceId === teamId) setTeamVotes((v) => v + 1);
      if (choiceId === opponentId) setOppVotes((v) => v + 1);
    }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("matchId", matchId);
        fd.set("teamId", choiceId);
        await predictMatchWinnerAction(fd);
        setError(null);
        router.refresh();
      } catch (e) {
        setMyVote(previous);
        setError(e instanceof Error ? e.message : "예측을 반영하지 못했어요.");
      }
    });
  }

  return (
    <div
      className="flex flex-col gap-[14px] rounded-2xl bg-white px-6 py-[22px] shadow-[0_20px_44px_rgba(0,0,0,0.22)]"
      style={{ color: "#16151b" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-black">팬 승부예측</span>
        <span className="text-[11px] font-bold text-[#9c9aa3]">
          {total > 0 ? `${total.toLocaleString()}명 참여 중` : "가장 먼저 예측해보세요"}
        </span>
      </div>

      <div className="flex flex-col gap-[7px]">
        <div className="flex h-3 overflow-hidden rounded-full bg-[#eeece8]">
          <span style={{ width: `${teamPct}%`, background: teamColor }} />
        </div>
        <div className="flex justify-between text-xs font-black">
          <span style={{ color: teamColor }}>
            {teamName} {teamPct}%
          </span>
          <span className="text-[#9c9aa3]">
            {opponentName} {oppPct}%
          </span>
        </div>
      </div>

      {!votable ? (
        <div className="rounded-full bg-[rgb(241,242,244)] py-[11px] text-center text-[13px] font-black text-[#8a8892]">
          {matchId ? "예측 마감" : "경기가 확정되면 열려요"}
        </div>
      ) : myVote ? (
        <div className="flex items-center justify-center gap-1.5 rounded-full bg-[#16151b] py-[11px] text-center text-[13px] font-black text-white">
          <span>내 예측 · {myVote === teamId ? teamName : opponentName}</span>
          <span className="text-white/60">✓</span>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => vote(teamId)}
            disabled={isPending}
            className="flex-1 rounded-full py-[11px] text-[13px] font-black text-white transition hover:opacity-90 disabled:opacity-70"
            style={{ background: teamColor }}
          >
            {teamName} 승
          </button>
          <button
            type="button"
            onClick={() => opponentId && vote(opponentId)}
            disabled={isPending}
            className="flex-1 rounded-full border border-[#dcdde1] py-[11px] text-[13px] font-black transition hover:bg-[rgb(242,243,245)] disabled:opacity-70"
            style={{ color: "#16151b" }}
          >
            {opponentName} 승
          </button>
        </div>
      )}

      {error ? <p className="text-center text-[11px] font-bold text-[#d24]">{error}</p> : null}

      {matchId && showDetailsLink ? (
        <Link
          href={`/matches/${matchId}`}
          className="text-center text-[11px] font-bold text-[#9c9aa3] transition hover:text-[#16151b]"
        >
          경기 상세 보기 →
        </Link>
      ) : null}
    </div>
  );
}
