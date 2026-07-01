"use client";

import { useState, useTransition } from "react";

import { syncTimelineAction } from "../../../actions";

export function SetTimelineSection({
  matchId,
  eventCount,
  ready,
}: {
  matchId: string;
  eventCount: number;
  ready: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runResync() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await syncTimelineAction(matchId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`세트 ${result.summary.setsProcessed}개 처리, 이벤트 ${result.summary.eventsInserted}개 저장`);
    });
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <p className="text-sm text-muted">이 세트에 저장된 타임라인 이벤트: {eventCount}개</p>
      <div>
        <button
          type="button"
          disabled={isPending || !ready}
          onClick={runResync}
          title={ready ? undefined : "Game ID와 결과(경기종료 이상) 상태가 준비돼야 타임라인을 불러올 수 있습니다."}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "타임라인 다시 가져오는 중..." : "타임라인 다시 가져오기"}
        </button>
      </div>
      {message ? <p className="text-sm text-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
