"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleFanAction } from "@/app/fan/[teamSlug]/actions";
import {
  FanHeaderTooltip,
  fanHeaderCountButtonClass,
  fanHeaderIconButtonClass,
} from "@/components/fan/fan-header-control-styles";
import { useToast } from "@/components/ui/toast";

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
  variant?: "hero" | "channel" | "spotlight" | "icon" | "header";
}) {
  const [count, setCount] = useState(initialCount);
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  // 낙관적 ±1은 어디까지나 임시값이다. router.refresh() 후 서버가 내려준 값이 바뀌면
  // 그쪽을 정답으로 삼아야 화면 숫자가 DB와 어긋난 채로 굳지 않는다.
  const [serverState, setServerState] = useState({ initialCount, initialFollowing });
  if (serverState.initialCount !== initialCount || serverState.initialFollowing !== initialFollowing) {
    setServerState({ initialCount, initialFollowing });
    setCount(initialCount);
    setFollowing(initialFollowing);
  }

  function handleClick() {
    const nextFollowing = !following;
    setFollowing(nextFollowing);
    setCount((c) => Math.max(0, c + (nextFollowing ? 1 : -1)));

    startTransition(async () => {
      const result = await toggleFanAction(teamId, teamSlug);
      if (!result.ok) {
        setFollowing(!nextFollowing);
        setCount((c) => Math.max(0, c + (nextFollowing ? -1 : 1)));
        showToast({ title: "팔로우 실패", description: "잠시 뒤 다시 시도해 주세요.", tone: "error" });
      } else {
        setFollowing(result.isFan);
        showToast({
          title: result.isFan ? "팬 등록 완료" : "팬 등록 해제",
          description: result.isFan ? "팀 소식을 더 빠르게 볼 수 있어요." : "언제든 다시 팔로우할 수 있어요.",
          tone: "success",
        });
        router.refresh();
      }
    });
  }

  const label = following ? "팔로잉" : "팔로우";
  const compactCount = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(count);
  const heart = (
    <Heart
      size={variant === "channel" ? 15 : 16}
      fill={following ? "currentColor" : "none"}
      strokeWidth={2.4}
      aria-hidden="true"
    />
  );

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={following ? `${teamName} 팔로우 취소, 팬 ${compactCount}` : `${teamName} 팔로우, 팬 ${compactCount}`}
        title={following ? "팔로우 취소" : "팔로우"}
        aria-pressed={following}
        className={fanHeaderCountButtonClass}
        style={following ? { color: teamColor } : undefined}
      >
        {heart}
        <span>{compactCount}</span>
        <FanHeaderTooltip>{following ? "팔로우 취소" : "팔로우"}</FanHeaderTooltip>
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={following ? `${teamName} 팔로우 취소` : `${teamName} 팔로우`}
        title={following ? "팔로우 취소" : "팔로우"}
        aria-pressed={following}
        className={fanHeaderIconButtonClass}
        style={following ? { color: teamColor } : undefined}
      >
        {heart}
        <FanHeaderTooltip>{following ? "팔로우 취소" : "팔로우"}</FanHeaderTooltip>
      </button>
    );
  }

  if (variant === "spotlight") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={following}
        className={`inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-extrabold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-ink)] active:scale-[0.98] disabled:opacity-60 sm:min-w-[9rem] ${
          following
            ? "border border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-muted)]"
            : "bg-[var(--ui-ink)] text-[var(--ui-surface)] hover:opacity-90"
        }`}
        style={following ? { color: teamColor } : undefined}
      >
        {heart}
        <span>{label}</span>
        <span className="hidden opacity-55 md:inline">{count.toLocaleString("ko-KR")}</span>
      </button>
    );
  }

  if (variant === "channel") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={following}
        className={`flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[14px] font-extrabold transition active:scale-[0.97] disabled:opacity-70 sm:w-auto sm:min-w-[8rem] sm:px-4 ${
          following
            ? "border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink)] hover:bg-[var(--ui-surface-muted)]"
            : "bg-[var(--ui-ink)] text-[var(--ui-surface)] hover:opacity-90"
        }`}
        style={following ? { color: teamColor } : undefined}
      >
        {heart}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={following}
      className={`inline-flex min-h-11 w-auto min-w-[9rem] shrink-0 items-center justify-center gap-2 rounded-full border px-6 py-2.5 text-sm font-extrabold shadow-sm transition active:scale-[0.97] disabled:opacity-70 ${
        following
          ? "border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink)] hover:bg-[var(--ui-surface-muted)]"
          : "border-[var(--ui-ink)] bg-[var(--ui-ink)] text-[var(--ui-surface)] hover:opacity-90"
      }`}
      style={following ? { color: teamColor } : undefined}
    >
      {heart}
      <span>{label}</span>
      <span className="opacity-60">{count.toLocaleString("ko-KR")}</span>
    </button>
  );
}
