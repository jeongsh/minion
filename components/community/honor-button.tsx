"use client";

import { useState, useTransition } from "react";

import { toggleHonorAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";

// 명예 버튼(토글). 비로그인/자기 글 등은 서버 액션이 막고 메시지를 돌려준다.
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
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={honored}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-muted disabled:opacity-60"
      >
        <span>{honored ? "명예 취소" : "명예"}</span>
        <span className="tabular-nums">{count}</span>
      </button>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </div>
  );
}
