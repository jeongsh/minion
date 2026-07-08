"use client";

import { useState, useTransition } from "react";

import { toggleFanAction } from "@/app/fan/[teamSlug]/actions";

// 팀 팔로우 — team_fans 집계에 실제 반영한다. 쿠키 기반 voterKey로
// 새로고침 후에도 팔로우 상태/카운트가 유지된다.
export function FanFollowButton({
  teamId,
  teamSlug,
  teamName,
  initialCount,
  initialFollowing,
  teamColor,
}: {
  teamId: string;
  teamSlug: string;
  teamName: string;
  initialCount: number;
  initialFollowing: boolean;
  teamColor: string;
}) {
  const [count, setCount] = useState(initialCount);
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    // 낙관적 업데이트 후 서버 반영, 실패 시 롤백.
    const nextFollowing = !following;
    setFollowing(nextFollowing);
    setCount((c) => Math.max(0, c + (nextFollowing ? 1 : -1)));

    startTransition(async () => {
      const result = await toggleFanAction(teamId, teamSlug);
      if (!result.ok) {
        setFollowing(!nextFollowing);
        setCount((c) => Math.max(0, c + (nextFollowing ? -1 : 1)));
      } else {
        setFollowing(result.isFan);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={following}
      className={`rounded-full px-5 py-2.5 text-sm font-extrabold transition active:scale-[0.97] disabled:opacity-70 ${
        following ? "border border-white/50 bg-transparent text-white hover:bg-white/10" : "bg-white hover:opacity-90"
      }`}
      style={following ? undefined : { color: teamColor }}
    >
      {following ? `${teamName} 팬` : "팬 되기"}
      <span className="ml-1 opacity-60">{count.toLocaleString("ko-KR")}</span>
    </button>
  );
}
