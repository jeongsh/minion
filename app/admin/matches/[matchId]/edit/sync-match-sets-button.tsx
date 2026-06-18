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

      const { summary } = result;
      const itemMsg = summary.itemsResolved > 0 ? ` · 아이템 ${summary.itemsResolved}개` : " · 아이템 없음";
      const spellMsg = summary.spellsResolved > 0 ? ` · 스펠 ${summary.spellsResolved}개` : "";
      const runeMsg = summary.runesResolved > 0 ? ` · 특성 ${summary.runesResolved}개` : "";
      setMessage(
        `Leaguepedia 세트 ${summary.fetched}개 조회, 세트 ${summary.upserted}개, 밴픽 ${summary.picksBansUpserted}개, 선수 스탯 ${summary.playerStatsUpserted}개 저장 완료${itemMsg}${spellMsg}${runeMsg}`,
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
