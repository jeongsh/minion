"use client";

import { Ban, FileText, Flag, MessageSquareText, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { RankAvatar } from "@/components/rank/rank-avatar";
import { useToast } from "@/components/ui/toast";
import {
  reportCommunityUserAction,
  setCommunityGuestBlockedAction,
  setCommunityUserBlockedAction,
} from "@/lib/community/user-actions";
import { reportCommentAction, reportPostAction } from "@/lib/community/actions";
import type { Tier } from "@/lib/rank/config";
import type { BoardScope } from "@/lib/community/boards";

type AuthorMenuProps = {
  authorId: string | null;
  authorName: string | null;
  authorImageUrl?: string | null;
  authorTier: Tier;
  viewerId?: string | null;
  variant?: "detail" | "comment" | "feed" | "profile";
  evidencePostId?: string;
  evidenceCommentId?: string;
  guestKey?: string | null;
  scope?: BoardScope;
  teamSlug?: string;
};

export function AuthorMenu({
  authorId,
  authorName,
  authorImageUrl,
  authorTier,
  viewerId,
  variant = "comment",
  evidencePostId,
  evidenceCommentId,
  guestKey,
  scope = "hub",
  teamSlug,
}: AuthorMenuProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { showToast } = useToast();
  const name = authorName ?? "알 수 없음";
  const isSelf = Boolean(authorId && authorId === viewerId);
  const isGuest = Boolean(!authorId && guestKey);

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

  const blockUser = () => {
    if (!authorId && !guestKey) return;
    const targetLabel = name;
    if (!window.confirm(`${targetLabel} 작성자의 글과 댓글을 내 화면에서 숨길까요?`)) return;
    setOpen(false);
    startTransition(async () => {
      const result = isGuest
        ? await setCommunityGuestBlockedAction({
            blocked: true,
            evidencePostId,
            evidenceCommentId,
          })
        : await setCommunityUserBlockedAction({ targetUserId: authorId!, blocked: true });
      showToast({
        title: result.ok ? "사용자 차단 완료" : "차단 실패",
        description: result.ok ? result.message : result.error,
        tone: result.ok ? "success" : "error",
      });
      if (result.ok) {
        router.refresh();
      }
    });
  };

  const reportUser = () => {
    if (!authorId && !guestKey) return;
    const reason = window.prompt("신고 사유를 입력해주세요. 운영자가 관련 활동과 함께 확인합니다.");
    if (reason === null) return;
    if (!reason.trim()) {
      showToast({ title: "신고 사유 필요", description: "신고 사유를 입력해주세요.", tone: "error" });
      return;
    }
    setOpen(false);
    startTransition(async () => {
      const result = isGuest
        ? evidenceCommentId && evidencePostId
          ? await reportCommentAction({ commentId: evidenceCommentId, postId: evidencePostId, reason, scope, teamSlug })
          : evidencePostId
            ? await reportPostAction({ postId: evidencePostId, reason, scope, teamSlug })
            : { ok: false as const, error: "신고할 작성 내역을 찾을 수 없습니다." }
        : await reportCommunityUserAction({
            targetUserId: authorId!,
            reason,
            evidencePostId,
            evidenceCommentId,
          });
      showToast({
        title: result.ok ? "사용자 신고 접수" : "신고 실패",
        description: result.ok ? result.message : result.error,
        tone: result.ok ? "success" : "error",
      });
    });
  };

  if (!authorId && !guestKey) {
    return <span className="text-sm font-semibold text-[var(--ui-muted)]">{name}</span>;
  }

  const trigger = variant === "feed" ? (
      <span className="inline-flex max-w-44 items-center gap-1 truncate font-medium text-[var(--ui-text)]">
      <span className="truncate">{name}</span>
    </span>
  ) : isGuest ? (
    <span className="inline-flex min-w-0 items-center gap-1 text-left">
      <span className="truncate text-sm font-semibold text-[var(--ui-ink)]">{name}</span>
    </span>
  ) : (
    <span className="inline-flex min-w-0 items-center gap-2.5 text-left">
      <RankAvatar
        tier={authorTier}
        src={authorImageUrl}
        alt={name}
        fallback={name.charAt(0)}
        size={variant === "profile" ? "lg" : variant === "detail" ? "md" : "sm"}
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1">
          <span className={`truncate font-semibold text-[var(--ui-ink)] ${variant === "profile" ? "font-paperozi text-[22px] sm:text-[26px]" : "text-sm"}`}>{name}</span>
        </span>
      </span>
    </span>
  );

  return (
    <div ref={rootRef} className="relative inline-flex min-w-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="min-w-0 inline-flex items-center rounded-lg text-left outline-none hover:opacity-75 focus-visible:ring-2 focus-visible:ring-[var(--tp)]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1.5 shadow-xl shadow-black/10"
        >
          {authorId && variant !== "profile" ? <MenuLink href={`/community/user/${authorId}`} icon={<UserRound size={16} />} label="프로필 보기" onSelect={() => setOpen(false)} /> : null}
          {authorId ? <MenuLink href={`/community/user/${authorId}?tab=posts`} icon={<FileText size={16} />} label="작성글 보기" onSelect={() => setOpen(false)} /> : null}
          {authorId ? <MenuLink href={`/community/user/${authorId}?tab=comments`} icon={<MessageSquareText size={16} />} label="작성 댓글 보기" onSelect={() => setOpen(false)} /> : null}
          {!isSelf ? (
            <>
              {authorId ? <div className="my-1 border-t border-[var(--ui-border)]" /> : null}
              <MenuButton icon={<Ban size={16} />} label={isGuest ? "이 비회원 차단" : "이 사용자 차단"} onClick={blockUser} disabled={pending} />
              <MenuButton icon={<Flag size={16} />} label="신고하기" onClick={reportUser} disabled={pending} danger />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({ href, icon, label, onSelect }: { href: string; icon: React.ReactNode; label: string; onSelect: () => void }) {
  return (
    <Link href={href} onClick={onSelect} role="menuitem" className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]">
      {icon}{label}
    </Link>
  );
}

function MenuButton({ icon, label, onClick, disabled, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; disabled: boolean; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled} className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-semibold hover:bg-[var(--ui-surface-muted)] disabled:opacity-50 ${danger ? "text-red-600" : "text-[var(--ui-text)]"}`}>
      {icon}{label}
    </button>
  );
}
