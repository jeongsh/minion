import { Skeleton } from "@/components/ui/skeleton";

export default function TransfersLoading() {
  return <main className="layout-wide pb-16 pt-5 sm:pt-7" data-route-loading="true" aria-busy="true" aria-label="이적시장 불러오는 중">
    <Skeleton className="mb-3 h-7 w-24 sm:h-[42px] sm:w-32" />
    <div className="mb-4 flex gap-2 overflow-hidden">{[264, 168, 195, 180, 172].map((width, i) => <div key={i} style={{ width }} className="shrink-0 rounded-lg bg-[var(--ui-card-bg)] px-3 py-2"><Skeleton className="h-7 w-full" /></div>)}</div>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="inline-flex h-[38px] shrink-0 items-center gap-0.5 rounded-[10px] bg-[var(--ui-card-bg)] p-[3px]"><Skeleton className="h-8 w-24 rounded-lg" /><Skeleton className="h-8 w-24 rounded-lg" /><Skeleton className="h-8 w-12 rounded-lg" /></div>
      <Skeleton className="h-8 w-[104px] shrink-0 rounded-md sm:w-[140px]" />
    </div>
    <div className="space-y-5">
      {Array.from({ length: 10 }, (_, i) => <div key={i} className="grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-md bg-[var(--ui-border)] p-px md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="col-span-2 min-w-0 bg-[var(--ui-surface)] dark:bg-[var(--ui-card-bg)] md:col-span-1">
          <div className="flex h-12 items-center gap-2.5 border-b border-[var(--ui-card-divider)] bg-[var(--ui-card-bg)] px-3"><Skeleton className="size-7" /><Skeleton className="h-5 w-24" /></div>
          <div className="divide-y divide-[var(--ui-card-divider)] dark:divide-transparent">
          {Array.from({ length: 6 }, (_, j) => <div key={j} className="grid min-h-14 grid-cols-[20px_minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-x-2 px-3 py-1.5 dark:odd:bg-[var(--ui-card-hover)]">
            <Skeleton className="size-5" /><Skeleton className="h-5 w-full" /><Skeleton className="size-[18px]" /><Skeleton className="h-5 w-full" />
          </div>)}
          </div>
        </div>
        {Array.from({ length: 2 }, (_, j) => <div key={j} className="@container/movement min-w-0 bg-[var(--ui-surface)] dark:bg-[var(--ui-card-bg)]">
          <div className="flex h-12 items-center border-b border-[var(--ui-card-divider)] bg-[var(--ui-card-bg)] px-3"><Skeleton className="h-5 w-16" /></div>
          <div className="grid min-h-14 min-w-0 grid-cols-[20px_minmax(0,1fr)] items-center gap-x-2 px-2 py-1.5 @[220px]/movement:px-3 dark:bg-[var(--ui-card-hover)]"><Skeleton className="size-5" /><div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"><Skeleton className="h-5 w-12" /><div className="flex items-center gap-2"><Skeleton className="size-5" /><Skeleton className="size-[18px]" /><Skeleton className="size-5" /></div></div></div>
        </div>)}
      </div>)}
    </div>
  </main>;
}
