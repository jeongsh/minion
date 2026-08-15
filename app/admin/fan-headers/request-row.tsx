"use client";

import { useState, useTransition } from "react";

import type { FanHeaderRequest } from "@/lib/fan/fan-header-admin";

import { applyFanHeaderAction, purgeFanHeaderRequestAction, reviewFanHeaderRequestAction } from "./actions";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FanHeaderRequestRow({ request }: { request: FanHeaderRequest }) {
  const [note, setNote] = useState(request.reviewNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "처리에 실패했어요.");
    });
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3.5 sm:flex-row sm:gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={request.imageUrl}
        alt=""
        className="aspect-[24/5] w-full shrink-0 rounded-xl object-cover sm:w-72"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-black text-[var(--ui-ink)]">{request.teamName}</span>
          {request.isApplied ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              현재 적용 중
            </span>
          ) : null}
          <span className="text-[12px] font-medium text-[var(--ui-muted)]">
            {request.requesterName ?? "익명 팬"} · {formatDate(request.createdAt)} · {request.width}×{request.height}
          </span>
        </div>

        {request.caption ? (
          <p className="text-[13px] font-medium text-[var(--ui-text)]">&ldquo;{request.caption}&rdquo;</p>
        ) : null}

        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="검토 메모 (선택)"
          className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ui-ink)] outline-none focus:border-[var(--ui-muted)]"
        />

        <div className="flex flex-wrap gap-1.5">
          {request.status !== "approved" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => reviewFanHeaderRequestAction(request.id, "approved", note))}
              className="rounded-full bg-[var(--ui-ink)] px-3 py-1.5 text-[12px] font-medium text-[var(--ui-surface)] disabled:opacity-50"
            >
              승인
            </button>
          ) : null}
          {request.status !== "rejected" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => reviewFanHeaderRequestAction(request.id, "rejected", note))}
              className="rounded-full border border-[var(--ui-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--ui-text)] disabled:opacity-50"
            >
              반려
            </button>
          ) : null}
          {request.status === "approved" && !request.isApplied ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => applyFanHeaderAction(request.id))}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
            >
              대문으로 적용
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => purgeFanHeaderRequestAction(request.id))}
            className="rounded-full border border-red-500/40 px-3 py-1.5 text-[12px] font-medium text-red-500 disabled:opacity-50"
          >
            삭제
          </button>
        </div>

        {error ? <p className="text-[12px] font-medium text-red-500">{error}</p> : null}
      </div>
    </article>
  );
}
