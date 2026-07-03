"use client";

import { useState, useTransition } from "react";

import { toggleFanAction } from "@/app/fan/[teamSlug]/actions";

// 응원 보내기 — 팀 응원(team_fans) 집계에 실제 반영한다. 쿠키 기반 voterKey로
// 새로고침 후에도 상태/카운트가 유지된다.
export function FanCheerButton({
  teamId,
  teamSlug,
  initialCount,
  initialCheered,
  teamColor,
}: {
  teamId: string;
  teamSlug: string;
  initialCount: number;
  initialCheered: boolean;
  teamColor: string;
}) {
  const [count, setCount] = useState(initialCount);
  const [cheered, setCheered] = useState(initialCheered);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    // 낙관적 업데이트 후 서버 반영, 실패 시 롤백.
    const nextCheered = !cheered;
    setCheered(nextCheered);
    setCount((c) => Math.max(0, c + (nextCheered ? 1 : -1)));

    startTransition(async () => {
      const result = await toggleFanAction(teamId, teamSlug);
      if (!result.ok) {
        setCheered(!nextCheered);
        setCount((c) => Math.max(0, c + (nextCheered ? -1 : 1)));
      } else {
        setCheered(result.isFan);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={cheered}
      className="font-archivo inline-flex items-center gap-2 rounded-full bg-white px-[26px] py-[13px] text-sm font-black transition hover:opacity-90 active:scale-[0.97] disabled:opacity-70"
      style={{ color: teamColor }}
    >
      <span>🔥 {cheered ? "응원 중" : "응원 보내기"}</span>
      {count > 0 ? (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-black"
          style={{ background: `${teamColor}1a`, color: teamColor }}
        >
          {count.toLocaleString()}
        </span>
      ) : null}
    </button>
  );
}
