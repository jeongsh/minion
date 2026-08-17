"use client";

import Link from "next/link";
import { ChevronRight, X } from "lucide-react";

import type { RatingMatchActivity } from "@/lib/match-activity";

export function RatingOpenCard({ rating, onClose }: { rating: RatingMatchActivity; onClose: () => void }) {
  return (
    <aside
      className="dismissible-activity-card rating-open-card match-activity-card relative flex min-h-[52px] w-full items-stretch rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[0_8px_24px_rgba(15,23,42,0.14)] transition-colors dark:bg-[var(--ui-surface-muted)]"
      role="status"
      aria-label={`${rating.setNumber}세트 평가 오픈 알림`}
    >
      <Link href={rating.href} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 min-[1200px]:gap-2.5 min-[1200px]:px-4">
        <span className="shrink-0 rounded-md bg-[var(--ui-ink)] px-2 py-1 text-[13px] font-bold leading-none text-[var(--ui-surface)]">평가</span>
        <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-[var(--ui-ink)] min-[1200px]:text-[15px]">{rating.setNumber}세트 평가가 열렸어요</p>
        <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-[var(--ui-muted)]">
          평가하기
          <ChevronRight size={15} />
        </span>
      </Link>
      <button type="button" onClick={onClose} className="activity-card-close absolute -right-2 -top-2 z-10 grid h-7 w-7 place-items-center rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-muted)] shadow-sm transition-colors hover:text-[var(--ui-ink)] dark:bg-[var(--ui-surface-muted)]" aria-label="평가 알림 닫기">
        <X size={14} />
      </button>
    </aside>
  );
}
