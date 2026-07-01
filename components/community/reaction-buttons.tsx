"use client";

import { useState, useTransition } from "react";

import { reactAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";
import type { ReactionKind, ReactionState, ReactionTarget } from "@/lib/community/types";

// 명예(♥) + 싫어요(👎) 리액션 버튼.
// 글/댓글 공용. 명예↔싫어요는 상호 배타(전환 시 이전 stance 자동 해제).
// size="md"(글 상세)와 size="sm"(댓글) 두 가지 밀도를 지원한다.
export function ReactionButtons({
  target,
  targetId,
  postId,
  scope,
  teamSlug,
  initialState,
  initialHonorCount,
  initialDislikeCount,
  size = "md",
}: {
  target: ReactionTarget;
  targetId: string;
  postId: string;
  scope: BoardScope;
  teamSlug?: string;
  initialState: ReactionState;
  initialHonorCount: number;
  initialDislikeCount: number;
  size?: "md" | "sm";
}) {
  const [state, setState] = useState<ReactionState>(initialState);
  const [honorCount, setHonorCount] = useState(initialHonorCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const press = (kind: ReactionKind) => {
    startTransition(async () => {
      const result = await reactAction({ target, targetId, kind, postId, scope, teamSlug });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      const next = result.state;
      // 카운트 동기화: 클릭 이전 stance(state) 대비 최종 stance(next)의 차이만큼 증감.
      setHonorCount((c) =>
        Math.max(0, c + (next === "honor" ? 1 : 0) - (state === "honor" ? 1 : 0)),
      );
      setDislikeCount((c) =>
        Math.max(0, c + (next === "dislike" ? 1 : 0) - (state === "dislike" ? 1 : 0)),
      );
      setState(next);
      setMessage(null);
    });
  };

  const honored = state === "honor";
  const disliked = state === "dislike";

  if (size === "sm") {
    const base =
      "inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors disabled:opacity-60";
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => press("honor")}
          disabled={pending}
          aria-pressed={honored}
          className={`${base} ${honored ? "text-accent" : "text-[#9aa3b5] hover:bg-[#f2f4f8]"}`}
        >
          <span aria-hidden>{honored ? "♥" : "♡"}</span>
          <span>명예 {honorCount}</span>
        </button>
        <button
          type="button"
          onClick={() => press("dislike")}
          disabled={pending}
          aria-pressed={disliked}
          className={`${base} ${disliked ? "text-[#d05a5a]" : "text-[#9aa3b5] hover:bg-[#f2f4f8]"}`}
        >
          <span aria-hidden>👎</span>
          <span>싫어요 {dislikeCount}</span>
        </button>
        {message ? <span className="text-[11px] text-[#c06868]">{message}</span> : null}
      </div>
    );
  }

  const base =
    "inline-flex items-center gap-2 rounded-[10px] border px-[22px] py-[11px] text-[14px] font-bold transition-colors disabled:opacity-60";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => press("honor")}
          disabled={pending}
          aria-pressed={honored}
          className={`${base} ${
            honored ? "border-accent bg-accent/10" : "border-[#e4e8ef] bg-white hover:bg-[#f7f9fc]"
          }`}
        >
          <span className="text-accent" aria-hidden>
            {honored ? "♥" : "♡"}
          </span>
          <span className="text-[#5d6678]">명예</span>
          <span className="tabular-nums text-[#28324a]">{honorCount}</span>
        </button>
        <button
          type="button"
          onClick={() => press("dislike")}
          disabled={pending}
          aria-pressed={disliked}
          className={`${base} ${
            disliked ? "border-[#f0c2c2] bg-[#fdeeee]" : "border-[#e4e8ef] bg-white hover:bg-[#f7f9fc]"
          }`}
        >
          <span aria-hidden>👎</span>
          <span className="text-[#5d6678]">싫어요</span>
          <span className="tabular-nums text-[#28324a]">{dislikeCount}</span>
        </button>
      </div>
      {message ? <p className="text-[12px] text-[#c06868]">{message}</p> : null}
    </div>
  );
}
