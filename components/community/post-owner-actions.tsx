"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deletePostAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";

export function PostOwnerActions({ postId, scope, teamSlug }: { postId: string; scope: BoardScope; teamSlug?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const basePath = scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : "/community";

  const remove = () => {
    if (!window.confirm("게시글을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.")) return;
    startTransition(async () => {
      const result = await deletePostAction({ postId, scope, teamSlug });
      if (!result.ok) { setMessage(result.error); return; }
      router.push(basePath);
      router.refresh();
    });
  };

  return (
    <span className="inline-flex items-center gap-3">
      <Link href={`${basePath}/post/${postId}/edit`} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] px-3.5 text-[14px] font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]"><Pencil size={15} strokeWidth={1.8} />수정</Link>
      <button type="button" onClick={remove} disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--ui-control-radius)] border border-red-300 px-3.5 text-[14px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"><Trash2 size={15} strokeWidth={1.8} />{pending ? "삭제 중" : "삭제"}</button>
      {message ? <span className="text-[12px] text-[var(--ui-muted)]">{message}</span> : null}
    </span>
  );
}
