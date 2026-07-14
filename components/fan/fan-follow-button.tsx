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
  variant = "hero",
}: {
  teamId: string;
  teamSlug: string;
  teamName: string;
  initialCount: number;
  initialFollowing: boolean;
  teamColor: string;
  variant?: "hero" | "channel";
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

  const label = following ? `${teamName} 팬` : "팬 되기";

  if (variant === "channel") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={following}
        className={`flex h-9 w-full min-w-0 items-center justify-center rounded-lg px-3 text-[14px] font-extrabold transition active:scale-[0.97] disabled:opacity-70 sm:h-10 sm:px-4 ${
          following
            ? "border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink)] hover:bg-[var(--ui-surface-muted)]"
            : "text-[var(--team-on-primary)] hover:brightness-95"
        }`}
        style={following ? undefined : { backgroundColor: teamColor }}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={following}
      className={`flex min-h-10 min-w-0 w-full items-center justify-center rounded-full border px-3 py-2 text-[13px] font-extrabold transition active:scale-[0.97] disabled:opacity-70 sm:min-h-11 sm:px-5 sm:py-2.5 sm:text-sm ${
        following ? "border-white/55 bg-transparent text-white hover:bg-white/10" : "border-white bg-white hover:opacity-90"
      }`}
      style={following ? undefined : { color: teamColor }}
    >
      {label}
      <span className="ml-1 opacity-60">{count.toLocaleString("ko-KR")}</span>
    </button>
  );
}
