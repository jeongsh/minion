"use client";

import { useState, useTransition } from "react";

import { syncLeaguepediaMatchesAction } from "./actions";

type SyncLeaguepediaButtonProps = {
  cursor: string | null;
};

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function SyncLeaguepediaButton({ cursor }: SyncLeaguepediaButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [endDate, setEndDate] = useState(() => dateInputValue(new Date()));
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return dateInputValue(date);
  });

  function runSync(mode: "incremental" | "full" | "range") {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await syncLeaguepediaMatchesAction(
        mode,
        mode === "range" ? { startDate, endDate } : undefined,
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const { summary } = result;
      setMessage(
        [
          `${
            summary.mode === "incremental"
              ? "증분"
              : summary.mode === "range"
                ? "기간"
                : "전체"
          } 동기화 완료`,
          `조회 ${summary.matchesFetched}건`,
          `생성 ${summary.matchesCreated}건`,
          `갱신 ${summary.matchesUpdated}건`,
          result.detailSummary
            ? `상세 ${result.detailSummary.matchesSynced}경기·${result.detailSummary.setsUpserted}세트`
            : null,
          result.detailSummary?.errors.length
            ? `상세 오류 ${result.detailSummary.errors.length}건`
            : null,
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

      <div className="grid gap-3 rounded-md border border-border bg-surface-muted p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          시작일
          <input
            type="date"
            value={startDate}
            max={endDate}
            disabled={isPending}
            onChange={(event) => setStartDate(event.target.value)}
            className="min-h-11 rounded-md border border-border bg-surface px-3 py-2 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          종료일
          <input
            type="date"
            value={endDate}
            min={startDate}
            disabled={isPending}
            onChange={(event) => setEndDate(event.target.value)}
            className="min-h-11 rounded-md border border-border bg-surface px-3 py-2 font-normal"
          />
        </label>
        <button
          type="button"
          disabled={isPending || !startDate || !endDate}
          onClick={() => runSync("range")}
          className="min-h-11 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
        >
          {isPending ? "동기화 중..." : "선택 기간 다시 동기화"}
        </button>
      </div>
      <p className="text-xs leading-5 text-muted">
        최대 31일까지 선택할 수 있으며, 완료 경기의 세트·밴픽·선수 데이터도 함께 보완합니다.
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

      {message ? (
        <p aria-live="polite" className="text-sm text-foreground">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
