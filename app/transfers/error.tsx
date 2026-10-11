"use client";
export default function TransferError({ reset }: { reset: () => void }) {
  return <main className="layout-wide py-12 text-center"><p className="text-base font-normal">이적시장을 불러오지 못했습니다.</p><button onClick={reset} className="mt-4 rounded-lg bg-[var(--ui-card-bg)] px-4 py-2 text-sm font-medium">다시 시도</button></main>;
}
