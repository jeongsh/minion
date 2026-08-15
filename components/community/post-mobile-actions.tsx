"use client";

import { Megaphone, MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PostOwnerActions } from "@/components/community/post-owner-actions";
import { setPostNoticeInlineAction } from "@/lib/community/admin-actions";
import type { BoardScope } from "@/lib/community/boards";

export function PostMobileActions({
  postId,
  scope,
  teamSlug,
  isNotice,
  canSetNotice,
  canManage,
  guest = false,
}: {
  postId: string;
  scope: BoardScope;
  teamSlug?: string;
  isNotice: boolean;
  canSetNotice: boolean;
  canManage: boolean;
  guest?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  if (!canSetNotice && !canManage) return null;

  return (
    <div ref={rootRef} className="fixed right-1 top-0 z-[60] md:hidden">
      <button type="button" onClick={() => setOpen((value) => !value)} className="grid h-12 w-11 place-items-center rounded-lg text-[var(--ui-ink)] outline-none focus-visible:bg-[var(--ui-surface-muted)]" aria-label="게시글 관리 메뉴" aria-haspopup="menu" aria-expanded={open}>
        <MoreVertical size={21} strokeWidth={2} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-1 top-11 w-40 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1.5 shadow-xl shadow-black/15">
          {canSetNotice ? (
            <form action={setPostNoticeInlineAction}>
              <input type="hidden" name="post_id" value={postId} />
              <input type="hidden" name="scope" value={scope} />
              {teamSlug ? <input type="hidden" name="team_slug" value={teamSlug} /> : null}
              <input type="hidden" name="is_notice" value={isNotice ? "false" : "true"} />
              <button type="submit" className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]">
                <Megaphone size={15} strokeWidth={1.8} />
                {isNotice ? "공지 해제" : "공지 등록"}
              </button>
            </form>
          ) : null}
          {canSetNotice && canManage ? <div className="my-1 border-t border-[var(--ui-border)]" /> : null}
          {canManage ? <PostOwnerActions postId={postId} scope={scope} teamSlug={teamSlug} guest={guest} variant="menu" /> : null}
        </div>
      ) : null}
    </div>
  );
}
