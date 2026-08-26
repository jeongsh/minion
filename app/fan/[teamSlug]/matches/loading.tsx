import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { Skeleton } from "@/components/ui/skeleton";

function FanCalendarLoadingSkeleton() {
  return (
    <main
      className="fan-page-shell w-full text-[var(--ui-ink)]"
      aria-label="팀 캘린더 불러오는 중"
      aria-busy="true"
      data-route-loading="true"
    >
      <div className="fan-page-container py-2 md:py-3">
        <div className="mb-1 flex h-9 items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="grid grid-cols-7 border-b border-[var(--ui-border)]">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={`weekday-${index}`} className="mx-auto my-1.5 h-[13px] w-4" />
          ))}
          {Array.from({ length: 42 }, (_, index) => (
            <div
              key={`day-${index}`}
              className="h-20 border-r border-t border-[var(--ui-border)] px-1 py-1 last:border-r-0 lg:overflow-hidden"
              style={{ height: "clamp(80px, calc((100svh - 190px) / 6), 148px)" }}
            >
              <Skeleton className="mx-auto h-5 w-5 lg:mx-0" />
              <div className="mt-1 hidden flex-col gap-1 lg:flex">
                {Array.from({ length: index % 3 }, (_, itemIndex) => (
                  <Skeleton key={`item-${index}-${itemIndex}`} className="h-5 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function Loading() {
  return (
    <>
      <FanCalendarLoadingSkeleton />
      <NavigationLoadingOverlay label="팀 일정을 불러오는 중입니다" />
    </>
  );
}
