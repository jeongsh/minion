"use client";

import { useState, useTransition } from "react";

import { reportCommentAction, reportPostAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";

// 리폿 버튼(글/댓글 공용). 비로그인/본인/중복은 서버 액션이 막는다.
export function ReportButton({
  target,
  postId,
  commentId,
  scope,
  teamSlug,
}: {
  target: "post" | "comment";
  postId: string;
  commentId?: string;
  scope: BoardScope;
  teamSlug?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result =
        target === "comment" && commentId
          ? await reportCommentAction({ commentId, postId, scope, teamSlug })
          : await reportPostAction({ postId, scope, teamSlug });

      if (result.ok) {
        setDone(true);
        setMessage(result.message ?? "리폿이 접수되었습니다.");
      } else {
        setMessage(result.error);
      }
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || done}
        className="text-xs font-semibold text-muted underline hover:text-foreground disabled:opacity-60"
      >
        리폿
      </button>
      {message ? <span className="text-xs text-muted">{message}</span> : null}
    </span>
  );
}
