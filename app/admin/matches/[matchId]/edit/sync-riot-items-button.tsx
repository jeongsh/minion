"use client";

import { useState, useTransition } from "react";

import { syncRiotMatchItemsAction } from "../../actions";

export function SyncRiotItemsButton({ matchId }: { matchId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runSync() {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await syncRiotMatchItemsAction(matchId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage(
        `Riot 아이템 ${result.summary.updated}명 갱신, ${result.summary.skipped}/${result.summary.sets}세트 건너뜀`,
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
        {isPending ? "Riot 아이템 동기화 중..." : "Riot 아이템 동기화"}
      </button>
      {message ? <p className="text-sm text-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
