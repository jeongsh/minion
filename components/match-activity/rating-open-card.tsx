"use client";

import Link from "next/link";
import { X } from "lucide-react";

import type { RatingMatchActivity } from "@/lib/match-activity";

export function RatingOpenCard({
  rating,
  onOpen,
  onClose,
}: {
  rating: RatingMatchActivity;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      className="dismissible-activity-card rating-open-card match-activity-card relative flex min-h-[52px] w-full items-stretch rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[0_8px_24px_rgba(15,23,42,0.14)] transition-colors dark:bg-[var(--ui-surface-muted)]"
      role="status"
      aria-label={`${rating.setNumber}세트 평가 오픈 알림`}
    >
      <Link href={rating.href} onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 rounded-l-xl px-3 py-2.5 min-[1200px]:gap-2.5 min-[1200px]:pl-4">
        <span className="shrink-0 rounded-md bg-[var(--ui-ink)] px-2 py-1 text-[13px] font-bold leading-none text-[var(--ui-surface)]">평가</span>
        <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-[var(--ui-ink)]">
          {rating.teamA.shortName} vs {rating.teamB.shortName}의 {rating.setNumber}세트 평가가 열렸어요
        </p>
      </Link>
      <button type="button" onClick={onClose} className="activity-card-close grid w-10 shrink-0 place-items-center text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-ink)]" aria-label="평가 알림 닫기">
        <X size={16} />
      </button>
    </aside>
  );
}
