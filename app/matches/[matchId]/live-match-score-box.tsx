"use client";

import { useEffect, useState } from "react";

import type { MatchScoreResponse } from "@/app/api/matches/[matchId]/score/route";

const POLL_INTERVAL_MS = 20_000;

/**
 * 매치 상세 상단 스코어. 경기가 끝나지 않았으면(poll) 가벼운 /score 엔드포인트를
 * 20초마다 폴링해, 세트가 끝날 때마다 페이지 새로고침 없이 스코어가 올라가게 한다.
 */
export function LiveMatchScoreBox({
  matchId,
  initialTeamAScore,
  initialTeamBScore,
  teamALoser,
  teamBLoser,
  poll,
}: {
  matchId: string;
  initialTeamAScore: number | null;
  initialTeamBScore: number | null;
  teamALoser: boolean;
  teamBLoser: boolean;
  poll: boolean;
}) {
  const [teamAScore, setTeamAScore] = useState(initialTeamAScore);
  const [teamBScore, setTeamBScore] = useState(initialTeamBScore);

  useEffect(() => {
    if (!poll) return;
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`/api/matches/${matchId}/score`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as MatchScoreResponse;
        if (cancelled) return;
        setTeamAScore(data.teamAScore);
        setTeamBScore(data.teamBScore);
        // 경기가 끝났으면 더 폴링하지 않는다(다음 페이지 진입 때 SSR 값이 최종본).
        if (data.status === "completed") window.clearInterval(timer);
      } catch {
        // 네트워크 흔들림은 무시하고 마지막 값을 유지한다.
      }
    }

    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    tick();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [matchId, poll]);

  return (
    <>
      <span className={teamALoser ? "opacity-45" : ""}>{teamAScore ?? "-"}</span>
      <span className="text-xs font-medium opacity-40">:</span>
      <span className={teamBLoser ? "opacity-45" : ""}>{teamBScore ?? "-"}</span>
    </>
  );
}
