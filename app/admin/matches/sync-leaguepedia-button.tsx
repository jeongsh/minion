"use client";

import { useState, useTransition } from "react";

import { syncLeaguepediaMatchesAction } from "./actions";

type SyncLeaguepediaButtonProps = {
  cursor: string | null;
};

export function SyncLeaguepediaButton({ cursor }: SyncLeaguepediaButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runSync(mode: "incremental" | "full") {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await syncLeaguepediaMatchesAction(mode);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const { summary } = result;
      setMessage(
        [
          `${summary.mode === "incremental" ? "증분" : "전체"} 동기화 완료`,
          `조회 ${summary.matchesFetched}건`,
          `생성 ${summary.matchesCreated}건`,
          `갱신 ${summary.matchesUpdated}건`,
          summary.skipped.length > 0 ? `건너뜀 ${summary.skipped.length}건` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-6 text-muted">
        기본 동기화는 마지막 종료(completed) 경기 이후 일정만 Leaguepedia에서 가져옵니다.
        매일 한 번 돌리기에 적합합니다.
      </p>
      <p className="text-sm text-muted">
        동기화 기준:{" "}
        <span className="font-medium text-foreground">
          {cursor ? new Date(cursor).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "없음 (전체 수집)"}
        </span>
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => runSync("incremental")}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
        >
          {isPending ? "동기화 중..." : "Leaguepedia 증분 동기화"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => runSync("full")}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          전체 동기화
        </button>
      </div>

      {message ? <p className="text-sm text-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
