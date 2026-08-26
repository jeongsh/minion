"use client";

import { Flag, MoreVertical } from "lucide-react";
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import { reportCommentAction, reportPostAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";

export function ReportButton({ target, postId, commentId, scope, teamSlug }: { target: "post" | "comment"; postId: string; commentId?: string; scope: BoardScope; teamSlug?: string }) {
  const { showToast } = useToast();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const postButton = target === "post";

  const onClick = () => startTransition(async () => {
    const result = target === "comment" && commentId
      ? await reportCommentAction({ commentId, postId, scope, teamSlug })
      : await reportPostAction({ postId, scope, teamSlug });

    if (result.ok) {
      const nextMessage = result.message ?? "신고가 접수됐습니다.";
      setDone(true);
      showToast({ title: "신고 접수 완료", description: nextMessage, tone: "success" });
      return;
    }

    showToast({ title: "신고 실패", description: result.error, tone: "error" });
  });

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || done}
        aria-label={postButton ? undefined : "리폿"}
        className={postButton
          ? "inline-flex h-9 items-center gap-1.5 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[13px] font-medium text-[var(--ui-muted)] transition-colors hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)] disabled:opacity-50 md:h-10 md:px-4 md:text-sm"
          : "grid h-8 w-8 place-items-center rounded-full text-[var(--ui-muted)] transition-colors hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)] disabled:opacity-50"}
      >
        {postButton ? <><Flag size={15} strokeWidth={1.8} />리폿</> : <MoreVertical size={17} strokeWidth={1.8} />}
      </button>
    </span>
  );
}
