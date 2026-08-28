"use client";

import { Lock } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { SupportInquiryDetail } from "@/lib/data/support";
import { unlockSupportInquiryAction } from "@/lib/support/actions";

const STATUS_LABEL = { open: "답변 대기", answered: "답변완료", closed: "종료" } as const;
const STATUS_CLASS = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  answered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  closed: "bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SupportDetail({ detail: initialDetail }: { detail: SupportInquiryDetail }) {
  const [detail, setDetail] = useState(initialDetail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onUnlock = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await unlockSupportInquiryAction(detail.id, password);
      if (result.ok) setDetail(result.detail);
      else setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${STATUS_CLASS[detail.status]}`}>
          {STATUS_LABEL[detail.status]}
        </span>
        <span className="text-[12px] text-[var(--ui-muted)]">{detail.authorLabel} · {formatDate(detail.createdAt)}</span>
      </div>

      <h1 className="flex items-center gap-2 text-[19px] font-black tracking-tight text-[var(--ui-ink)]">
        {detail.isPrivate ? <Lock size={16} strokeWidth={2} className="shrink-0 text-[var(--ui-muted)]" /> : null}
        {detail.subject}
      </h1>

      {detail.locked && detail.hasPassword ? (
        <form onSubmit={onUnlock} className="flex flex-col gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
          <p className="text-[13px] text-[var(--ui-text)]">비밀번호를 입력하면 내용을 볼 수 있어요.</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              className="min-w-0 flex-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 text-[14px] text-[var(--ui-text)] outline-none focus:border-[var(--ui-muted)]"
            />
            <Button type="submit" disabled={pending || !password}>
              {pending ? "확인 중" : "확인"}
            </Button>
          </div>
          {error ? <p className="text-[13px] font-medium text-red-500">{error}</p> : null}
        </form>
      ) : detail.locked ? (
        <p className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4 text-[13px] text-[var(--ui-text)]">
          작성자만 볼 수 있는 글이에요.
        </p>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-[14px] leading-7 text-[var(--ui-text)]">{detail.message}</p>

          {detail.reply ? (
            <div className="rounded-xl bg-[var(--ui-surface-muted)] p-4">
              <p className="text-[13px] font-semibold text-[var(--ui-ink)]">
                MINION 답변{detail.answeredAt ? ` · ${formatDate(detail.answeredAt)}` : ""}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-7 text-[var(--ui-text)]">{detail.reply}</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
