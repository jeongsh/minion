"use client";

// 블라인드된 글/댓글 본문 접기. 삭제와 달리 내용은 남아 있으며,
// 이용자가 명시적으로 선택한 경우에만 펼쳐 보여준다(자동/신고 블라인드 1차 방어 UI).
// 문구는 호출부가 lib/community/moderation-labels.ts 의 blindLabel/blindDescription 으로 만든다.

import { EyeOff } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

export function BlindedContent({
  children,
  label,
  description,
  compact = false,
}: {
  children: ReactNode;
  /** 한 줄 안내(예: "정화봇이 차단한 게시글입니다"). */
  label: string;
  /** 상세 화면 보조 설명. compact 에서는 무시된다. */
  description?: string;
  /** 댓글 등 좁은 영역용 축소 스타일. */
  compact?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) return <>{children}</>;

  if (compact) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-[var(--ui-control-radius)] bg-[var(--ui-surface-muted)] px-3 py-2 text-[13px] text-[var(--ui-muted)]">
        <EyeOff size={14} strokeWidth={1.8} className="shrink-0" />
        <span>{label}.</span>
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
        <p className="font-semibold text-[var(--ui-ink)]">{label}</p>
        {description ? (
          <p className="mt-1 text-sm text-[var(--ui-muted)]">{description}</p>
        ) : null}
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
