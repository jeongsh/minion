import { Skeleton } from "@/components/ui/skeleton";

export function HomeRatingTickerSkeleton({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`hidden h-14 items-center gap-4 rounded-xl border border-[var(--ui-card-bg)] bg-[var(--ui-surface)] px-4 md:flex ${className}`}>
      <Skeleton className="h-4 w-24 shrink-0" />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Skeleton className="h-4 w-16 shrink-0" />
        <Skeleton className="h-6 w-16 shrink-0" />
        <Skeleton className="h-4 w-full max-w-80" />
      <Skeleton className="size-4 shrink-0" />
      </div>
    </div>
  );
}
