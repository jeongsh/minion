"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { reactAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";
import type { ReactionKind, ReactionState, ReactionTarget } from "@/lib/community/types";

export function ReactionButtons({ target, targetId, postId, scope, teamSlug, initialState, initialHonorCount, initialDislikeCount, size = "md" }: { target: ReactionTarget; targetId: string; postId: string; scope: BoardScope; teamSlug?: string; initialState: ReactionState; initialHonorCount: number; initialDislikeCount: number; size?: "md" | "sm" }) {
  const [state, setState] = useState<ReactionState>(initialState);
  const [honorCount, setHonorCount] = useState(initialHonorCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  const press = (kind: ReactionKind) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const previousState = state;
    const previousHonorCount = honorCount;
    const previousDislikeCount = dislikeCount;
    const next = state === kind ? null : kind;
    const applyState = (nextState: ReactionState) => {
      setHonorCount(Math.max(0, previousHonorCount + (nextState === "honor" ? 1 : 0) - (previousState === "honor" ? 1 : 0)));
      setDislikeCount(Math.max(0, previousDislikeCount + (nextState === "dislike" ? 1 : 0) - (previousState === "dislike" ? 1 : 0)));
      setState(nextState);
    };
    const rollback = () => {
      setState(previousState);
      setHonorCount(previousHonorCount);
      setDislikeCount(previousDislikeCount);
    };
    applyState(next);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await reactAction({ target, targetId, kind, postId, scope, teamSlug });
        if (!result.ok) {
          rollback();
          setMessage(result.error);
          return;
        }
        applyState(result.state);
      } catch {
        rollback();
        setMessage("반응을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.");
      } finally {
        inFlight.current = false;
      }
    });
  };

  const compact = size === "sm";
  const buttonClass = compact
    ? "inline-flex h-8 items-center gap-1 rounded-[var(--ui-control-radius)] px-2 text-xs font-medium text-[var(--ui-muted)] transition-colors hover:bg-[var(--ui-surface-muted)] disabled:opacity-50"
    : "inline-flex h-9 items-center gap-1.5 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[13px] font-medium transition-colors hover:bg-[var(--ui-surface-muted)] disabled:opacity-50 md:h-10 md:gap-2 md:px-4 md:text-sm";

  return (
    <div className={compact ? "flex flex-col items-end gap-1" : "flex flex-col items-center gap-2"}>
      <div className={compact ? "flex items-center gap-1" : "flex items-center gap-2"}>
        <button type="button" onClick={() => press("honor")} disabled={pending} aria-label={`와드 ${honorCount}`} aria-pressed={state === "honor"} className={`${buttonClass} ${state === "honor" ? "text-[var(--tp)]" : compact ? "text-[var(--ui-muted)]" : "text-[var(--ui-text)]"}`}>
          <ThumbsUp className={compact ? "h-4 w-4" : "h-4 w-4 md:h-[18px] md:w-[18px]"} strokeWidth={1.8} />{compact ? <span>{honorCount}</span> : <span>와드 {honorCount}</span>}
        </button>
        <button type="button" onClick={() => press("dislike")} disabled={pending} aria-label={`비추천 ${dislikeCount}`} aria-pressed={state === "dislike"} className={`${buttonClass} ${state === "dislike" ? "text-[var(--tp)]" : compact ? "text-[var(--ui-muted)]" : "text-[var(--ui-text)]"}`}>
          <ThumbsDown className={compact ? "h-4 w-4" : "h-4 w-4 md:h-[18px] md:w-[18px]"} strokeWidth={1.8} />{compact ? <span>{dislikeCount}</span> : <span>비추천 {dislikeCount}</span>}
        </button>
      </div>
      {message ? <p className="text-[13px] text-[var(--ui-muted)]">{message}</p> : null}
    </div>
  );
}
