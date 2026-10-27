"use client";

import { Ban, FileText, Flag, MessageSquareText, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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
import type { CommunityAuthorTeam } from "@/lib/community/types";

type AuthorMenuProps = {
  authorId: string | null;
  authorName: string | null;
  authorImageUrl?: string | null;
  authorTier: Tier;
  /** 작성자의 최애팀. 설정한 경우 닉네임 옆에 작은 팀 마크를 표시한다. */
  authorTeam?: CommunityAuthorTeam | null;
  viewerId?: string | null;
  variant?: "detail" | "comment" | "feed" | "profile";
  evidencePostId?: string;
  evidenceCommentId?: string;
  guestKey?: string | null;
  scope?: BoardScope;
  teamSlug?: string;
  detailMeta?: React.ReactNode;
  hideAvatar?: boolean;
  customTrigger?: React.ReactNode;
};

function TeamBadge({ team, size }: { team: CommunityAuthorTeam; size: "detail" | "profile" | "comment" }) {
  const paddingClass = size === "profile" ? "px-2" : "px-1.5";
  // 배경을 테마색과 섞지 않고 팀색 그대로 칠해서, 라이트/다크 어느 배경 위에서도
  // 항상 같은 대비를 유지한다. 글씨색은 배경 밝기에 맞춰 검정/흰색으로 고정.
  const style: React.CSSProperties = {
    background: team.primaryColor,
    color: contrastAnchor(team.primaryColor),
  };
  return (
    <span
      title={`${team.name} 팬`}
      style={style}
      className={`inline-flex shrink-0 items-center rounded-full py-0.5 text-xs font-medium leading-none ${paddingClass}`}
    >
      {team.shortName}
    </span>
  );
}

function contrastAnchor(hex: string) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#111318" : "#ffffff";
}

export function AuthorMenu({
  authorId,
  authorName,
  authorImageUrl,
  authorTier,
  authorTeam = null,
  viewerId,
  variant = "comment",
  evidencePostId,
  evidenceCommentId,
  guestKey,
  scope = "hub",
  teamSlug,
  detailMeta,
  hideAvatar = false,
  customTrigger,
}: AuthorMenuProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ position: "fixed" });
  const router = useRouter();
  const { showToast } = useToast();
  const name = authorName ?? "알 수 없음";
  const isSelf = Boolean(authorId && authorId === viewerId);
  const isGuest = Boolean(!authorId && guestKey);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!triggerRef.current || !menuRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const margin = 12;
      const below = window.innerHeight - rect.bottom - margin - 8;
      const above = rect.top - margin - 8;
      const height = menuRef.current.scrollHeight + 2;
      const placeAbove = height > below && above > below;
      const maxHeight = Math.max(0, placeAbove ? above : below);
      setMenuStyle({
        position: "fixed",
        left: Math.max(margin, Math.min(rect.left, window.innerWidth - Math.min(208, window.innerWidth - margin * 2) - margin)),
        top: placeAbove ? Math.max(margin, rect.top - Math.min(height, maxHeight) - 8) : rect.bottom + 8,
        maxHeight,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
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
      const result = isGuest || !viewerId
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
    return customTrigger ?? <span className="text-[13px] font-medium leading-[18px] text-[var(--ui-muted)]">{name}</span>;
  }

  const guestAvatar = (size: "detail" | "comment") => (
    <span className={`grid shrink-0 place-items-center rounded-full bg-[var(--ui-surface-muted)] text-[var(--ui-muted)] ${size === "detail" ? "h-9 w-9 md:h-10 md:w-10" : "h-8 w-8"}`} aria-hidden="true">
      <UserRound size={size === "detail" ? 21 : 18} strokeWidth={1.7} />
    </span>
  );

  const trigger = variant === "detail" ? (
    <span className="inline-flex min-w-0 items-center gap-3 text-left">
      {isGuest ? guestAvatar("detail") : (
        <>
          <span className="md:hidden"><RankAvatar tier={authorTier} src={authorImageUrl} alt={name} fallback={name.charAt(0)} size="detail" /></span>
          <span className="hidden md:inline-grid"><RankAvatar tier={authorTier} src={authorImageUrl} alt={name} fallback={name.charAt(0)} size="md" /></span>
        </>
      )}
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1">
          {authorTeam ? <TeamBadge team={authorTeam} size="detail" /> : null}
          <span className="truncate text-[13px] font-semibold leading-[18px] text-[var(--ui-ink)] md:text-[15px] md:leading-5">{name}</span>
        </span>
        {detailMeta ? <span className="block text-[12px] font-normal leading-[18px] text-[var(--ui-muted)] md:mt-0.5 md:text-[13px] md:leading-5">{detailMeta}</span> : null}
      </span>
    </span>
  ) : variant === "feed" ? (
      // 피드 목록 행에는 프로필 이미지가 없으므로 팀 마크도 붙이지 않는다.
      <span className="inline-flex max-w-44 items-center gap-1 truncate font-medium text-[var(--ui-text)]">
      <span className="truncate">{name}</span>
    </span>
  ) : isGuest ? (
    <span className="inline-flex min-w-0 items-center gap-2.5 text-left">
      {hideAvatar ? null : guestAvatar("comment")}
      <span className="truncate text-[13px] font-medium leading-[18px] text-[var(--ui-ink)]">{name}</span>
    </span>
  ) : (
    <span className="inline-flex min-w-0 items-center gap-2.5 text-left">
      {hideAvatar ? null : (
        <RankAvatar
          tier={authorTier}
          src={authorImageUrl}
          alt={name}
          fallback={name.charAt(0)}
          size={variant === "profile" ? "lg" : "sm"}
        />
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          {authorTeam ? <TeamBadge team={authorTeam} size={variant === "profile" ? "profile" : "comment"} /> : null}
          <span className={`truncate text-[var(--ui-ink)] ${variant === "profile" ? "font-paperozi text-[22px] font-semibold sm:text-[26px]" : "text-[13px] font-medium leading-[18px]"}`}>{name}</span>
        </span>
      </span>
    </span>
  );

  return (
    <div ref={rootRef} className="relative inline-flex min-w-0 self-start">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="min-w-0 inline-flex items-center rounded-lg text-left outline-none hover:opacity-75"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={customTrigger ? `${name} 사용자 메뉴` : undefined}
      >
        {customTrigger ?? trigger}
      </button>
      {open ? createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          role="menu"
          aria-label={`${name} 사용자 메뉴`}
          className="z-50 w-52 max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1.5 shadow-xl shadow-black/10"
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
        </div>, document.body
      ) : null}
    </div>
  );
}

function MenuLink({ href, icon, label, onSelect }: { href: string; icon: React.ReactNode; label: string; onSelect: () => void }) {
  return (
    <Link href={href} onClick={onSelect} role="menuitem" className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]">
      {icon}{label}
    </Link>
  );
}

function MenuButton({ icon, label, onClick, disabled, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; disabled: boolean; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled} className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium hover:bg-[var(--ui-surface-muted)] disabled:opacity-50 ${danger ? "text-red-600" : "text-[var(--ui-text)]"}`}>
      {icon}{label}
    </button>
  );
}
