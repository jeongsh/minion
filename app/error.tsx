"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="layout-reading py-24 text-center">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ui-muted)]">Unexpected Error</p>
      <h1 className="mt-3 text-2xl font-black text-[var(--ui-ink)]">화면을 불러오지 못했습니다.</h1>
      <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ui-muted)]">
        일시적인 오류일 수 있습니다. 다시 시도해도 반복되면 운영자가 digest 값을 기준으로 추적할 수 있습니다.
      </p>
      {error.digest ? <p className="mt-3 text-xs font-mono text-[var(--ui-muted)]">digest: {error.digest}</p> : null}
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-[var(--ui-ink)] px-5 py-2.5 text-sm font-black text-[var(--ui-surface)]"
      >
        다시 시도
      </button>
    </main>
  );
}
