"use client";

import { Flag } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
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

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, pending]);

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
        showToast({ title: "신고 접수 완료", description: nextMessage, tone: "success" });
        return;
      }

      showToast({ title: "신고 실패", description: result.error, tone: "error" });
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
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="modal-backdrop fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 [--modal-backdrop-dark-mobile:0.65] sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
              <section className="adaptive-dialog-panel flex w-full max-w-md flex-col overflow-hidden rounded-t-[24px] bg-[var(--ui-surface)] shadow-2xl sm:rounded-[24px] sm:border sm:border-[var(--ui-border)] dark:bg-[var(--ui-surface-muted)]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <DialogSheetHeader onClose={close} title={`${postButton ? "게시글" : "댓글"} 리폿`} titleId={titleId} />
                <form className="px-5 pb-5 pt-2" onSubmit={(event) => { event.preventDefault(); submit(); }}>
                  <p className="text-base font-normal leading-6 text-[var(--ui-text)]">리폿 사유를 입력해주세요. 운영자가 해당 내용을 확인합니다.</p>
                  <textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={5} placeholder="리폿 사유" className="mt-4 block min-h-28 w-full resize-none rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 text-base font-normal leading-6 text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)] focus:border-[var(--ui-ink)] dark:bg-[var(--ui-surface-muted)]" />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-normal tabular-nums text-[var(--ui-muted)]">{reason.length.toLocaleString("ko-KR")}/1,000자</span>
                    <button type="submit" disabled={!reason.trim() || pending} className="h-10 rounded-[var(--ui-control-radius)] bg-red-600 px-5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">{pending ? "접수 중" : "리폿하기"}</button>
                  </div>
                </form>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
