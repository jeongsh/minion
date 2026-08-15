"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState, useTransition } from "react";

import { reactAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";
import type { ReactionKind, ReactionState, ReactionTarget } from "@/lib/community/types";

export function ReactionButtons({ target, targetId, postId, scope, teamSlug, initialState, initialHonorCount, initialDislikeCount, size = "md" }: { target: ReactionTarget; targetId: string; postId: string; scope: BoardScope; teamSlug?: string; initialState: ReactionState; initialHonorCount: number; initialDislikeCount: number; size?: "md" | "sm" }) {
  const [state, setState] = useState<ReactionState>(initialState);
  const [honorCount, setHonorCount] = useState(initialHonorCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const press = (kind: ReactionKind) => {
    startTransition(async () => {
      const result = await reactAction({ target, targetId, kind, postId, scope, teamSlug });
      if (!result.ok) { setMessage(result.error); return; }
      const next = result.state;
      setHonorCount((count) => Math.max(0, count + (next === "honor" ? 1 : 0) - (state === "honor" ? 1 : 0)));
      setDislikeCount((count) => Math.max(0, count + (next === "dislike" ? 1 : 0) - (state === "dislike" ? 1 : 0)));
      setState(next);
      setMessage(null);
    });
  };

  const compact = size === "sm";
  const buttonClass = compact
    ? "inline-flex h-7 items-center gap-1 rounded-[var(--ui-control-radius)] px-1.5 text-[13px] font-medium hover:bg-[var(--ui-surface-muted)] disabled:opacity-50"
    : "inline-flex h-9 items-center gap-1.5 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[13px] font-semibold hover:bg-[var(--ui-surface-muted)] disabled:opacity-50 md:h-10 md:gap-2 md:px-4 md:text-sm";

  return (
    <div className={compact ? "flex flex-col items-end gap-1" : "flex flex-col items-center gap-2"}>
      <div className={compact ? "flex items-center gap-1" : "flex items-center gap-2"}>
        <button type="button" onClick={() => press("honor")} disabled={pending} aria-pressed={state === "honor"} className={`${buttonClass} ${state === "honor" ? "text-[var(--tp)]" : "text-[var(--ui-text)]"}`}>
          <ThumbsUp className={compact ? "h-3.5 w-3.5" : "h-4 w-4 md:h-[18px] md:w-[18px]"} strokeWidth={1.8} /><span>와드 {honorCount}</span>
        </button>
        <button type="button" onClick={() => press("dislike")} disabled={pending} aria-pressed={state === "dislike"} className={`${buttonClass} ${state === "dislike" ? "text-[var(--tp)]" : "text-[var(--ui-text)]"}`}>
          <ThumbsDown className={compact ? "h-3.5 w-3.5" : "h-4 w-4 md:h-[18px] md:w-[18px]"} strokeWidth={1.8} /><span>비추천 {dislikeCount}</span>
        </button>
      </div>
      {message ? <p className="text-[13px] text-[var(--ui-muted)]">{message}</p> : null}
    </div>
  );
}
