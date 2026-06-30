"use client";

import { useState, useTransition } from "react";

import { toggleHonorAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";

// 명예 버튼(토글) — 시안 2a. 중앙 배치용 알약형. 하트만 accent, 본문은 중립.
export function HonorButton({
  postId,
  scope,
  teamSlug,
  initialHonored,
  initialCount,
}: {
  postId: string;
  scope: BoardScope;
  teamSlug?: string;
  initialHonored: boolean;
  initialCount: number;
}) {
  const [honored, setHonored] = useState(initialHonored);
  const [count, setCount] = useState(initialCount);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result = await toggleHonorAction({ postId, scope, teamSlug });
      if (result.ok) {
        const nextHonored = !honored;
        setHonored(nextHonored);
        setCount((prev) => (nextHonored ? prev + 1 : Math.max(0, prev - 1)));
        setMessage(null);
      } else {
        setMessage(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={honored}
        className={`inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-bold transition-colors disabled:opacity-60 ${
          honored
            ? "border-accent bg-accent/10 text-accent"
            : "border-border bg-surface text-foreground hover:bg-surface-muted"
        }`}
      >
        <span className={honored ? "text-accent" : "text-accent"} aria-hidden>
          {honored ? "♥" : "♡"}
        </span>
        <span>명예</span>
        <span className="tabular-nums">{count}</span>
      </button>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </div>
  );
}
