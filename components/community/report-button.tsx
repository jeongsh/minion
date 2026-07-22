"use client";

import { Flag } from "lucide-react";
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import { reportCommentAction, reportPostAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";

export function ReportButton({ target, postId, commentId, scope, teamSlug }: { target: "post" | "comment"; postId: string; commentId?: string; scope: BoardScope; teamSlug?: string }) {
  const { showToast } = useToast();
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const onClick = () => startTransition(async () => {
    const result = target === "comment" && commentId
      ? await reportCommentAction({ commentId, postId, scope, teamSlug })
      : await reportPostAction({ postId, scope, teamSlug });

    if (result.ok) {
      const nextMessage = result.message ?? "신고가 접수됐습니다.";
      setDone(true);
      setMessage(nextMessage);
      showToast({ title: "신고 접수 완료", description: nextMessage, tone: "success" });
      return;
    }

    setMessage(result.error);
    showToast({ title: "신고 실패", description: result.error, tone: "error" });
  });

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={onClick} disabled={pending || done} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-ink)] disabled:opacity-50">
        <Flag size={13} strokeWidth={1.8} />리폿
      </button>
      {message ? <span className="text-[13px] text-[var(--ui-muted)]">{message}</span> : null}
    </span>
  );
}
