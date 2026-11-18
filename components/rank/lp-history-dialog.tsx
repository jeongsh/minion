"use client";

import { useState } from "react";

import { dialogBodyClassName, ControlledDialog, DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
import type { LedgerEntry } from "@/lib/rank/queries";

function reasonLabel(reason: string) {
  if (reason.startsWith("관리자 지급:")) return reason;
  const labels: Record<string, string> = {
    attendance: "출석체크",
    post_created: "게시글 작성",
    comment_created: "댓글 작성",
    honor_received: "명예(좋아요) 받음",
    honor_removed: "명예 취소",
    dishonor_received: "비추천 받음",
    dishonor_removed: "비추천 취소",
    reported: "신고 누적 제재",
    prediction_bet_placed: "승부예측 참여",
    prediction_bet_cancelled: "승부예측 취소",
    prediction_bet_won: "승부예측 적중",
    prediction_bet_refunded: "승부예측 환불",
  };
  return labels[reason] ?? reason;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function LpHistoryDialog({ lp, entries, compact = false }: {
  lp: number;
  entries: LedgerEntry[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={"LP " + lp.toLocaleString("ko-KR") + ", 이력 보기"}
      className={compact
        ? "rounded-md text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
        : "rounded-md font-black tabular-nums text-[var(--ui-ink)] hover:text-[var(--accent)]"}
    >
      {lp.toLocaleString("ko-KR")} LP
    </button>
    <ControlledDialog open={open} onClose={() => setOpen(false)} labelledBy="lp-history-title" panelClassName="sm:max-w-lg">
      <DialogSheetHeader onClose={() => setOpen(false)} title="최근 LP 이력" titleId="lp-history-title" />
      <div className={dialogBodyClassName}>
        <p className="mb-3 text-sm text-[var(--ui-muted)]">현재 보유 LP {lp.toLocaleString("ko-KR")} · 최근 10건</p>
        {entries.length > 0 ? <ul className="divide-y divide-[var(--ui-border)] rounded-xl border border-[var(--ui-border)]">
          {entries.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <span className={entry.delta > 0 ? "min-w-24 text-sm font-semibold tabular-nums text-green-700" : "min-w-24 text-sm font-semibold tabular-nums text-red-700"}>
              {entry.delta > 0 ? "+" : ""}{entry.delta.toLocaleString("ko-KR")} LP
            </span>
            <span className="min-w-0 flex-1 text-sm text-[var(--ui-text)]">{reasonLabel(entry.reason)}</span>
            <time className="text-[13px] font-medium text-[var(--ui-muted)]" dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
          </li>)}
        </ul> : <p className="rounded-xl border border-dashed border-[var(--ui-border)] px-4 py-8 text-center text-sm text-[var(--ui-muted)]">아직 LP 변동 내역이 없습니다.</p>}
      </div>
    </ControlledDialog>
  </>;
}
