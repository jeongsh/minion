"use client";

import { usePathname } from "next/navigation";
import { NeutralLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

function AccountSummary({ mobile = false }: { mobile?: boolean }) {
  return (
    <section className={`me-card rounded-xl border p-4 sm:rounded-2xl ${mobile ? "lg:hidden" : "hidden p-6 lg:block"}`}>
      <div className={`flex items-center gap-2.5 ${mobile ? "" : "flex-col gap-4"}`}>
        <Skeleton className={mobile ? "size-14 shrink-0 rounded-full" : "size-24 rounded-full"} />
        <div className={`min-w-0 space-y-2 ${mobile ? "flex-1" : "w-full"}`}>
          <Skeleton className={`h-5 w-28 ${mobile ? "" : "mx-auto"}`} />
          <Skeleton className={`h-4 w-36 max-w-full ${mobile ? "" : "mx-auto"}`} />
        </div>
      </div>
      <Skeleton className={`${mobile ? "mt-3 h-1" : "mt-5 h-24 rounded-2xl"} w-full`} />
      <Skeleton className="mt-3 h-9 w-full rounded-lg sm:h-11" />
      {mobile ? <div className="mt-2 grid grid-cols-2 gap-2"><Skeleton className="h-9 rounded-lg" /><Skeleton className="h-9 rounded-lg" /></div> : null}
    </section>
  );
}

function AccountSection({ profile = false }: { profile?: boolean }) {
  return (
    <section className="me-card rounded-xl border p-4 sm:rounded-2xl sm:p-6">
      <div className="mb-4 flex items-center gap-2 sm:mb-5 sm:gap-3">
        <Skeleton className="size-[30px] rounded-lg sm:size-10 sm:rounded-xl" />
        <Skeleton className="h-5 w-20" />
      </div>
      {profile ? (
        <div className="flex flex-col gap-3 sm:gap-5">
          <div className="flex items-center gap-4">
            <Skeleton className="hidden size-24 shrink-0 rounded-full sm:block" />
            <div className="space-y-2"><Skeleton className="h-9 w-40 rounded-lg sm:h-11" /><Skeleton className="h-4 w-44 max-w-full" /></div>
          </div>
          <div className="space-y-1.5"><Skeleton className="h-[18px] w-14" /><Skeleton className="h-9 w-full rounded-lg sm:h-11" /><Skeleton className="h-5 w-60 max-w-full" /></div>
          <Skeleton className="h-9 w-full rounded-lg sm:h-11" />
        </div>
      ) : (
        <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full rounded-lg" />)}</div>
      )}
    </section>
  );
}

export function AccountLoadingSkeleton() {
  return (
    <main className="layout-wide me-page max-w-6xl pb-6 pt-3 sm:py-8" aria-label="내 계정 불러오는 중" aria-busy="true" data-route-loading="true">
      <AccountSummary mobile />
      <Skeleton className="mt-2.5 h-11 w-full rounded-xl lg:hidden" />
      <div className="mt-2.5 grid grid-cols-4 gap-1.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 lg:hidden">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-9 rounded-lg" />)}
      </div>
      <div className="mt-2.5 grid items-start gap-5 sm:mt-5 lg:mt-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden space-y-4 lg:block">
          <AccountSummary />
          <div className="me-card space-y-2 rounded-2xl border p-2">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-12 rounded-xl" />)}</div>
        </aside>
        <div className="min-w-0 space-y-2.5 sm:space-y-5"><AccountSection profile /><AccountSection /><AccountSection /></div>
      </div>
    </main>
  );
}

export function AccountRouteLoading() {
  const pathname = usePathname();
  return ["/me", "/me/profile", "/me/settings"].includes(pathname) ? <AccountLoadingSkeleton /> : <NeutralLoadingSkeleton />;
}
