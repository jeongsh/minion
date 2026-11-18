"use client";

import { Flag } from "lucide-react";
import { useId, useState, useTransition } from "react";


import { dialogBodyClassName, ControlledDialog, DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { reportCommentAction, reportPostAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";

export function ReportButton({ target, postId, commentId, scope, teamSlug }: { target: "post" | "comment"; postId: string; commentId?: string; scope: BoardScope; teamSlug?: string }) {
  const { showToast } = useToast();
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const titleId = useId();
  const postButton = target === "post";



  const close = () => {
    if (pending) return;
    setOpen(false);
  };

  const submit = () => {
    const value = reason.trim();
    if (!value || pending) return;
    startTransition(async () => {
      const result = target === "comment" && commentId
        ? await reportCommentAction({ commentId, postId, reason: value, scope, teamSlug })
        : await reportPostAction({ postId, reason: value, scope, teamSlug });

      if (result.ok) {
        const nextMessage = result.message ?? "신고가 접수됐습니다.";
        setDone(true);
        setOpen(false);
        showToast({ title: nextMessage, tone: "success" });
        return;
      }

      showToast({ title: result.error, tone: "error" });
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setReason("");
          setOpen(true);
        }}
        disabled={pending || done}
        aria-label={postButton ? undefined : "리폿"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={postButton
          ? "inline-flex h-9 items-center gap-1.5 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[13px] font-medium text-[var(--ui-muted)] transition-colors hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)] disabled:opacity-50 md:h-10 md:px-4 md:text-sm"
          : "grid h-8 w-8 place-items-center rounded-full text-[var(--ui-muted)] transition-colors hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)] disabled:opacity-50"}
      >
        {postButton ? <><Flag size={15} strokeWidth={1.8} />리폿</> : <Flag size={17} strokeWidth={1.8} />}
      </button>
      {<ControlledDialog open={open} onClose={close} labelledBy={titleId} panelClassName="sm:max-w-md">
                <DialogSheetHeader onClose={close} title={`${postButton ? "게시글" : "댓글"} 리폿`} titleId={titleId} />
                <form className={dialogBodyClassName} onSubmit={(event) => { event.preventDefault(); submit(); }}>
                  <p className="text-sm font-normal leading-[21px] text-[var(--ui-text)]">리폿 사유를 입력해주세요. 운영자가 해당 내용을 확인합니다.</p>
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="리폿 사유" className="mt-3.5 block h-28 w-full resize-none rounded-[10px] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 text-sm font-normal leading-[21px] text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)] focus-visible:border-[var(--ui-muted)]" />
                  <Button type="submit" disabled={!reason.trim() || pending} className="mt-3 w-full" style={{ backgroundColor: reason.trim() && !pending ? "#dc2626" : "var(--ui-border)", color: "#fff", opacity: 1 }}>{pending ? "접수 중" : "리폿하기"}</Button>
                </form>
              </ControlledDialog>}
    </>
  );
}
