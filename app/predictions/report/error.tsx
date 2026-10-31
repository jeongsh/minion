"use client";

import { Button } from "@/components/ui/button";

export default function PredictionReportError({ reset }: { reset: () => void }) {
  return (
    <main className="layout-wide flex flex-col items-center gap-5 py-20 text-center">
      <h1 className="home-section-title text-[28px] text-[var(--ui-ink)]">예측 기록을 불러오지 못했습니다</h1>
      <p className="text-base text-[var(--ui-muted)]">잠시 후 다시 시도해 주세요.</p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
