"use client";

import { Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";

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
            <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/55 px-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmOpen(false)}>
              <section className="adaptive-dialog-panel w-full max-w-sm rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 shadow-2xl dark:bg-[var(--ui-surface-muted)]" role="dialog" aria-modal="true" aria-labelledby="delete-post-title">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-black text-red-500">DELETE POST</p>
                    <h2 id="delete-post-title" className="mt-1 text-lg font-black text-[var(--ui-ink)]">게시글을 삭제할까요?</h2>
                  </div>
                  <button type="button" onClick={() => setConfirmOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]" aria-label="닫기"><X size={18} /></button>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ui-muted)]">삭제한 게시글은 복구할 수 없습니다.</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfirmOpen(false)} className="h-10 rounded-lg bg-[var(--ui-surface-muted)] text-sm font-black text-[var(--ui-ink)]">취소</button>
                  <button type="button" onClick={remove} disabled={pending} className="h-10 rounded-lg bg-[var(--palette-tomato-butter-main)] text-sm font-black text-white transition hover:bg-[var(--palette-tomato-butter-hover)] disabled:opacity-50">삭제</button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
