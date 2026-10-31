import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="layout-wide min-w-0 space-y-5 py-6 sm:py-8 xl:px-10" aria-busy="true" aria-label="내 예측 리포트 불러오는 중">
      <Skeleton className="h-9 w-44" />
      <div className="flex gap-3"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-28" /></div>
      <Skeleton className="h-[89px] w-full rounded-lg" />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"><Skeleton className="h-[374px] w-full rounded-xl" /><Skeleton className="h-[374px] w-full rounded-xl" /></div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </main>
  );
}
