"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteGuestPostAction, deletePostAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";

export function PostOwnerActions({ postId, scope, teamSlug, guest = false, variant = "buttons" }: { postId: string; scope: BoardScope; teamSlug?: string; guest?: boolean; variant?: "buttons" | "menu" }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const basePath = scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : "/community";
  const menu = variant === "menu";

  const remove = () => {
    startTransition(async () => {
      const result = guest
        ? await deleteGuestPostAction({ postId, scope, teamSlug })
        : await deletePostAction({ postId, scope, teamSlug });
      if (!result.ok) {
        setMessage(result.error);
        showToast({ title: "삭제 실패", description: result.error, tone: "error" });
        return;
      }
      showToast({ title: "게시글 삭제 완료", description: "목록으로 이동합니다.", tone: "success" });
      router.push(basePath);
      router.refresh();
    });
  };

  return (
    <>
      <span className={menu ? "flex flex-col items-stretch gap-1" : "inline-flex items-center gap-2 md:gap-3"}>
        <Link href={`${basePath}/post/${postId}/edit`} className={menu ? "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]" : "inline-flex h-9 w-9 items-center justify-center rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] text-sm font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)] md:w-auto md:gap-1.5 md:px-3.5"} aria-label="게시글 수정"><Pencil size={15} strokeWidth={1.8} /><span className={menu ? "inline" : "hidden md:inline"}>수정</span></Link>
        <button type="button" onClick={() => setConfirmOpen(true)} disabled={pending} className={menu ? "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-red-500 hover:bg-[var(--ui-surface-muted)] disabled:opacity-50" : "inline-flex h-9 w-9 items-center justify-center rounded-[var(--ui-control-radius)] border border-red-300 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 md:w-auto md:gap-1.5 md:px-3.5 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"} aria-label={pending ? "게시글 삭제 중" : "게시글 삭제"}><Trash2 size={15} strokeWidth={1.8} /><span className={menu ? "inline" : "hidden md:inline"}>{pending ? "삭제 중" : "삭제"}</span></button>
        {message ? <span className="text-[13px] text-[var(--ui-muted)]">{message}</span> : null}
      </span>
      {confirmOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="modal-backdrop fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 [--modal-backdrop-dark-mobile:0.65] sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmOpen(false)}>
              <section className="adaptive-dialog-panel flex w-full max-w-sm flex-col overflow-hidden rounded-t-[24px] bg-[var(--ui-surface)] shadow-2xl sm:rounded-[24px] sm:border sm:border-[var(--ui-border)] dark:bg-[var(--ui-surface-muted)]" role="dialog" aria-modal="true" aria-labelledby="delete-post-title">
                <DialogSheetHeader onClose={() => setConfirmOpen(false)} title="게시글 삭제" titleId="delete-post-title" />
                <div className="px-5 pb-5 pt-2">
                  <p className="text-[13px] font-medium text-red-500">DELETE POST</p>
                  <h3 className="mt-1 text-lg font-black text-[var(--ui-ink)]">게시글을 삭제할까요?</h3>
                  <p className="mt-3 text-sm font-medium leading-6 text-[var(--ui-muted)]">삭제한 게시글은 복구할 수 없습니다.</p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setConfirmOpen(false)} className="h-10 rounded-lg bg-[var(--ui-surface-muted)] text-sm font-medium text-[var(--ui-ink)]">취소</button>
                    <button type="button" onClick={remove} disabled={pending} className="h-10 rounded-lg bg-[var(--palette-tomato-butter-main)] text-sm font-medium text-white transition hover:bg-[var(--palette-tomato-butter-hover)] disabled:opacity-50">삭제</button>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
