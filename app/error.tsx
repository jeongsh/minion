"use client";

import { useEffect } from "react";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";

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
    <main className="layout-reading py-24">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ui-muted)]">Unexpected Error</p>
      <KitschEmptyState
        character="marker"
        title="화면이 잠깐 삐끗했어요"
        body="다시 시도해도 반복되면 digest 값으로 추적할 수 있습니다."
        animated
        action={
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-[var(--ui-ink)] px-5 py-2.5 text-sm font-black text-[var(--ui-surface)]"
          >
            다시 시도
          </button>
        }
        className="mt-4"
      />
      {error.digest ? <p className="mt-3 text-center text-xs font-mono text-[var(--ui-muted)]">digest: {error.digest}</p> : null}
    </main>
  );
}
