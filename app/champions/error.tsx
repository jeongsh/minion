"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ChampionsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-[70vh] px-5 py-12 text-[var(--ui-text)]">
      <section className="mx-auto grid min-h-72 max-w-xl place-items-center rounded-xl bg-[var(--ui-surface)] p-6 text-center">
        <div>
          <p className="font-paperozi text-[20px] text-[var(--ui-ink)]">챔피언 통계를 불러오지 못했습니다.</p>
          <p className="mt-2 text-[14px] font-normal leading-6 text-[var(--ui-muted)]">잠시 후 다시 시도하거나 챔피언 목록에서 다른 범위를 선택해 주세요.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={reset} className="h-10 rounded-lg bg-[var(--ui-ink)] px-4 text-[14px] font-medium text-[var(--ui-surface)]">다시 시도</button>
            <Link href="/champions" className="flex h-10 items-center rounded-lg bg-[var(--ui-card-bg)] px-4 text-[14px] font-medium text-[var(--ui-ink)]">챔피언 목록</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
