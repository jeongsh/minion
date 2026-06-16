"use client";

import { useState, useTransition } from "react";

import { syncLeaguepediaMatchSetsAction } from "../../actions";

export function SyncMatchSetsButton({ matchId }: { matchId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runSync() {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await syncLeaguepediaMatchSetsAction(matchId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage(
        `Leaguepedia 세트 ${result.summary.fetched}개 조회, 세트 ${result.summary.upserted}개, 밴픽 ${result.summary.picksBansUpserted}개, 선수 스탯 ${result.summary.playerStatsUpserted}개 저장 완료`,
      );
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
        {isPending ? "세트 결과 불러오는 중..." : "세트 결과 불러오기"}
      </button>
      {message ? <p className="text-sm text-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
