"use client";

// 블라인드된 글/댓글 본문 접기. 삭제와 달리 내용은 남아 있으며,
// 이용자가 명시적으로 선택한 경우에만 펼쳐 보여준다(신고 누적 1차 방어 UI).

import { EyeOff } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

export function BlindedContent({
  children,
  compact = false,
}: {
  children: ReactNode;
  /** 댓글 등 좁은 영역용 축소 스타일. */
  compact?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) return <>{children}</>;

  if (compact) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-[var(--ui-control-radius)] bg-[var(--ui-surface-muted)] px-3 py-2 text-[13px] text-[var(--ui-muted)]">
        <EyeOff size={14} strokeWidth={1.8} className="shrink-0" />
        <span>신고 누적으로 가려진 댓글입니다.</span>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="font-semibold text-[var(--ui-text)] underline underline-offset-2 hover:text-[var(--ui-ink)]"
        >
          내용 보기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--ui-card-radius)] bg-[var(--ui-surface-muted)] px-6 py-12 text-center">
      <EyeOff size={28} strokeWidth={1.6} className="text-[var(--ui-muted)]" />
      <div>
        <p className="font-semibold text-[var(--ui-ink)]">신고 누적으로 블라인드된 게시글입니다</p>
        <p className="mt-1 text-sm text-[var(--ui-muted)]">
          운영진 검토 중인 글로, 내용이 부적절할 수 있습니다.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-2 text-sm font-semibold text-[var(--ui-text)] hover:border-[var(--ui-ink)] hover:text-[var(--ui-ink)]"
      >
        내용 보기
      </button>
    </div>
  );
}
