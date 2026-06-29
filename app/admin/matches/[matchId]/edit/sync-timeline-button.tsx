"use client";

import { useState, useTransition } from "react";

import { syncTimelineAction } from "../../actions";

export function SyncTimelineButton({ matchId }: { matchId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runSync() {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await syncTimelineAction(matchId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const { summary } = result;
      if (summary.setsProcessed === 0 && summary.setsFailed === 0) {
        setMessage("이미 모든 세트의 타임라인이 저장되어 있습니다.");
      } else {
        setMessage(
          `세트 ${summary.setsProcessed}개 처리 완료, 이벤트 ${summary.eventsInserted}개 저장${summary.setsFailed > 0 ? ` (실패 ${summary.setsFailed}개)` : ""}`,
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={runSync}
        className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-muted disabled:opacity-60"
      >
        {isPending ? "타임라인 불러오는 중..." : "타임라인 불러오기"}
      </button>
      {message ? <p className="text-sm text-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
