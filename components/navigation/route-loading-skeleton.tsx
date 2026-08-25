import { Skeleton } from "@/components/ui/skeleton";

function LoadingMain({ children, className = "layout-wide flex flex-col" }: { children?: React.ReactNode; className?: string }) {
  return (
    <main className={className} aria-label="페이지 콘텐츠 불러오는 중" aria-busy="true" data-route-loading="true">
      {children}
    </main>
  );
}

function SectionTitle({ width = "w-28" }: { width?: string }) {
  return <Skeleton className={`h-5 ${width}`} />;
}

function MatchRowSkeleton() {
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-2.5 border-b border-[var(--ui-border)] px-3 py-3 last:border-b-0 md:grid-cols-[140px_minmax(0,1fr)_160px] md:gap-4 md:px-5 md:py-4">
      <div className="space-y-2"><Skeleton className="h-4 w-10" /><Skeleton className="h-3 w-8" /></div>
      <div className="grid grid-cols-[minmax(0,1fr)_30px_minmax(0,1fr)] items-center gap-1 sm:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] sm:gap-2 md:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] md:gap-3.5">
        <div className="flex items-center justify-end gap-1.5 md:gap-2.5"><Skeleton className="h-4 w-10 sm:w-14" /><Skeleton className="h-7 w-7 rounded-full sm:h-9 sm:w-9 md:h-11 md:w-11" /></div>
        <Skeleton className="mx-auto h-5 w-8" />
        <div className="flex items-center gap-1.5 md:gap-2.5"><Skeleton className="h-7 w-7 rounded-full sm:h-9 sm:w-9 md:h-11 md:w-11" /><Skeleton className="h-4 w-10 sm:w-14" /></div>
      </div>
      <div className="hidden space-y-2 md:block"><Skeleton className="ml-auto h-3.5 w-24" /><Skeleton className="ml-auto h-3 w-16" /></div>
    </div>
  );
}

function TableRows({ count = 7 }: { count?: number }) {
  return (
    <div className="divide-y divide-[var(--ui-border)]">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="grid min-h-14 grid-cols-[2rem_2.25rem_minmax(0,1fr)_4rem_4rem] items-center gap-3 px-3 py-2.5 sm:px-4">
          <Skeleton className="h-4 w-5" /><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-4 w-28 max-w-full" /><Skeleton className="h-4 w-12" /><Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

function NewsPageRows({ count = 7 }: { count?: number }) {
  return (
    <div className="grid gap-4 min-[390px]:gap-5">
      {Array.from({ length: count }, (_, index) => (
        <article key={index} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 min-[390px]:grid-cols-[84px_minmax(0,1fr)] min-[390px]:gap-3 min-[390px]:p-2.5 sm:grid-cols-[196px_minmax(0,1fr)] sm:gap-5 sm:rounded-2xl sm:p-3 lg:p-4">
          <Skeleton className="aspect-[4/3] w-full rounded-md sm:aspect-[16/10] sm:rounded-lg" />
          <div className="flex min-w-0 flex-col py-0.5">
            <div className="flex items-center justify-between gap-2"><Skeleton className="h-2.5 w-12 sm:h-3 sm:w-16" /><Skeleton className="h-2.5 w-16 sm:h-3 sm:w-20" /></div>
            <Skeleton className="mt-2 h-3 w-full sm:h-4" />
            <Skeleton className="mt-1.5 h-3 w-4/5 sm:h-4" />
            <Skeleton className="mt-2 hidden h-3 w-11/12 sm:block" />
          </div>
        </article>
      ))}
    </div>
  );
}

function CommunityPostRows({ count = 9 }: { count?: number }) {
  return (
    <div className="divide-y divide-[var(--ui-border)]">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 px-2.5 py-2 min-[390px]:min-h-[65px] min-[390px]:gap-3 min-[390px]:px-3 sm:min-h-[72px] sm:gap-4 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5"><Skeleton className="h-3 w-9" /><Skeleton className="h-3.5 w-[min(72%,15rem)]" /></div>
            <div className="mt-2 flex items-center gap-2"><Skeleton className="h-2.5 w-14" /><Skeleton className="h-2.5 w-10" /><Skeleton className="h-2.5 w-8" /><Skeleton className="h-2.5 w-8" /></div>
          </div>
          {index % 3 !== 1 ? <Skeleton className="h-[51px] w-[68px] rounded-md min-[390px]:h-[57px] min-[390px]:w-[76px] min-[390px]:rounded-lg sm:h-[70px] sm:w-[120px]" /> : null}
        </div>
      ))}
    </div>
  );
}

function CommunityFeedSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="mobile-full-bleed mobile-list-shell overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] sm:mx-0">
      <div className="flex items-start gap-2 border-b border-[var(--ui-border)] px-3 py-2.5 sm:px-4 sm:py-3">
        <Skeleton className="h-9 w-[132px] rounded-[var(--ui-control-radius)]" />
        <Skeleton className="h-9 w-28 rounded-[var(--ui-control-radius)]" />
        <Skeleton className="ml-auto h-9 w-9 rounded-[var(--ui-control-radius)] md:hidden" />
        <Skeleton className="ml-auto hidden h-9 w-60 rounded-[var(--ui-control-radius)] md:block" />
        <Skeleton className="hidden h-9 w-20 rounded-[var(--ui-control-radius)] lg:block" />
      </div>
      <CommunityPostRows count={count} />
      <div className="flex justify-center gap-2 border-t border-[var(--ui-border)] px-3 py-2 sm:px-4"><Skeleton className="h-9 w-9 rounded-lg" /><Skeleton className="h-9 w-9 rounded-lg" /><Skeleton className="h-9 w-9 rounded-lg" /></div>
    </div>
  );
}

export function NeutralLoadingSkeleton() {
  return <LoadingMain />;
}

export function HomeLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col gap-8 py-5 md:py-7">
      <section className="overflow-hidden">
        <div className="flex gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="min-w-[min(86vw,340px)] flex-1 rounded-xl bg-[var(--ui-card-bg)] p-4 sm:min-w-0">
              <div className="flex justify-between"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-16" /></div>
              <div className="mt-4 flex items-center justify-center gap-3"><Skeleton className="h-9 w-16" /><Skeleton className="h-8 w-12 rounded-lg" /><Skeleton className="h-9 w-16" /></div>
              <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-3 h-11 w-full rounded-xl" />
      </section>
      <section className="grid gap-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
        <div><SectionTitle width="w-24" /><Skeleton className="mt-4 aspect-video w-full rounded-xl" /><Skeleton className="mt-3 h-4 w-4/5" /><Skeleton className="mt-2 h-3 w-2/5" /></div>
        <div><SectionTitle width="w-20" /><div className="mt-4"><TableRows count={5} /></div></div>
      </section>
      <Skeleton className="h-24 w-full rounded-2xl" />
    </LoadingMain>
  );
}

export function ScheduleLoadingSkeleton() {
  return (
    <LoadingMain className="schedule-page flex flex-col">
      <div className="schedule-mobile-sticky border-b border-[var(--ui-border)] lg:hidden"><div className="layout-wide py-2"><div className="grid grid-cols-7 gap-1 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)] p-1">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className={`h-11 w-full rounded-lg ${index === 3 ? "bg-[var(--ui-ink)]" : ""}`} />)}</div></div></div>
      <div className="mt-2 hidden border-b border-[var(--ui-border)] lg:block"><div className="layout-wide flex items-center justify-between gap-4 py-2.5"><div className="flex gap-2"><Skeleton className="h-9 w-9 rounded-lg" /><Skeleton className="h-9 w-28 rounded-lg" /><Skeleton className="h-9 w-9 rounded-lg" /></div><div className="flex gap-2"><Skeleton className="h-9 w-24 rounded-lg" /><Skeleton className="h-9 w-24 rounded-lg" /></div></div></div>
      <div className="layout-wide mt-7 flex flex-col gap-8 lg:mt-10">
        {Array.from({ length: 3 }, (_, day) => (
          <section key={day}><div className="mb-3 flex items-center gap-2"><Skeleton className="h-6 w-24" />{day === 0 ? <Skeleton className="h-6 w-12 rounded-full" /> : null}</div><div className="overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">{Array.from({ length: day === 0 ? 3 : 2 }, (_, row) => <MatchRowSkeleton key={row} />)}</div></section>
        ))}
      </div>
    </LoadingMain>
  );
}

export function TournamentLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col gap-6 pt-6 sm:pt-10">
      <header className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-40" /></div></div><Skeleton className="h-10 w-24 rounded-xl" /></header>
      <div className="flex gap-2 overflow-hidden">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-10 w-24 shrink-0 rounded-xl" />)}</div>
      <div className="flex flex-col gap-3 border-b border-[var(--ui-border)] pb-3 sm:flex-row sm:items-end sm:justify-between"><div className="flex gap-5"><Skeleton className="h-9 w-20 rounded-none" /><Skeleton className="h-9 w-24 rounded-none" /><Skeleton className="h-9 w-24 rounded-none" /></div><div className="flex gap-1"><Skeleton className="h-9 w-20 rounded-lg" /><Skeleton className="h-9 w-20 rounded-lg" /><Skeleton className="h-9 w-20 rounded-lg" /></div></div>
      <section className="grid gap-4 sm:grid-cols-2"><div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"><div className="p-4"><SectionTitle /></div><TableRows count={5} /></div><div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"><div className="p-4"><SectionTitle /></div><TableRows count={5} /></div></section>
    </LoadingMain>
  );
}

export function PredictionLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col pt-6 sm:pt-8 xl:px-10">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div><div className="flex items-center justify-between rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4"><Skeleton className="h-9 w-44 rounded-lg" /><Skeleton className="h-7 w-24 rounded-lg" /></div><div className="mt-9 space-y-10">{Array.from({ length: 2 }, (_, day) => <section key={day}><Skeleton className="mb-3 h-6 w-24" /><div className="space-y-5">{Array.from({ length: 3 }, (_, row) => <div key={row}><div className="mb-2 flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-24" /></div><Skeleton className="h-[76px] w-full rounded-xl" /></div>)}</div></section>)}</div></div>
        <aside className="hidden overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 xl:block"><SectionTitle /><div className="mt-4"><TableRows count={7} /></div></aside>
      </div>
    </LoadingMain>
  );
}

export function PlayersLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col pb-16 pt-6 sm:pt-8">
      <div className="mb-4 flex justify-between"><Skeleton className="h-10 w-36 rounded-xl" /><Skeleton className="h-4 w-14" /></div>
      <div className="md:grid md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 md:block"><Skeleton className="h-3 w-16" /><div className="mt-3 grid grid-cols-2 gap-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-10 w-full rounded-xl" />)}</div><Skeleton className="mt-6 h-3 w-10" /><div className="mt-3 space-y-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-11 w-full rounded-xl" />)}</div></aside>
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 10 }, (_, index) => <div key={index} className="overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"><Skeleton className="aspect-[4/5] w-full rounded-none" /><div className="space-y-2 p-3"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-4/5" /></div></div>)}</section>
      </div>
    </LoadingMain>
  );
}

export function NewsLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col pb-16 pt-4 min-[390px]:pt-5 sm:pt-7">
      <section className="mb-4 rounded-lg bg-[var(--ui-card-bg)] p-1.5 sm:mb-7 sm:rounded-xl sm:p-2.5"><div className="flex gap-0.5 overflow-hidden sm:gap-1">{Array.from({ length: 9 }, (_, index) => <Skeleton key={index} className="h-8 w-[66px] shrink-0 rounded-md sm:h-9 sm:w-20" />)}</div><div className="mt-1 flex gap-1.5 sm:mt-2 sm:gap-2"><Skeleton className="h-8 flex-1 rounded-md sm:h-10" /><Skeleton className="h-8 w-[54px] rounded-md sm:h-10 sm:w-16" /></div></section>
      <div className="mb-1 flex items-end gap-2"><SectionTitle width="w-20 min-[390px]:w-24" /><Skeleton className="h-3 w-14" /></div>
      <NewsPageRows />
    </LoadingMain>
  );
}

export function CommunityLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col gap-5 pb-6 sm:py-8">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start xl:gap-6"><section><Skeleton className="community-mobile-ad h-[60px] w-full !rounded-none md:mb-4 xl:hidden" /><CommunityFeedSkeleton /></section><aside className="hidden space-y-4 xl:block"><div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"><div className="border-b border-[var(--ui-border)] p-4"><SectionTitle width="w-20" /></div><CommunityPostRows count={5} /></div><Skeleton className="h-[250px] w-full rounded-xl" /></aside></div>
    </LoadingMain>
  );
}

export function TeamsLoadingSkeleton() {
  return (
    <LoadingMain className="flex flex-col">
      <section className="border-b border-[var(--ui-border)]"><div className="layout-wide py-6"><SectionTitle width="w-24" /><div className="mt-4 flex gap-3 overflow-hidden">{Array.from({ length: 10 }, (_, index) => <div key={index} className="flex w-[76px] shrink-0 flex-col items-center gap-2 rounded-2xl bg-[var(--ui-surface-muted)] px-2 py-3"><Skeleton className="h-12 w-12 rounded-full" /><Skeleton className="h-3 w-10" /></div>)}</div></div></section>
      <div className="layout-wide pb-24 pt-7"><Skeleton className="h-[76px] w-full rounded-2xl" /><section className="mt-9"><SectionTitle /><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="aspect-square w-full rounded-2xl" />)}</div></section><section className="mt-10"><SectionTitle /><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="aspect-video w-full rounded-2xl" />)}</div></section></div>
    </LoadingMain>
  );
}

export function MatchLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col gap-5 pb-12 pt-5">
      <section className="mobile-full-bleed overflow-hidden rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] md:mx-0"><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-2"><Skeleton className="h-3 w-24 max-w-full" /><Skeleton className="h-6 w-16 rounded-full" /><Skeleton className="ml-auto h-3 w-20 max-w-full" /></div><div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-3 sm:gap-5 sm:px-6 sm:py-4"><div className="flex min-w-0 items-center justify-end gap-2"><Skeleton className="h-5 w-12 sm:w-20" /><Skeleton className="h-9 w-9 rounded-full sm:h-12 sm:w-12" /></div><Skeleton className="h-10 w-[88px] rounded-xl sm:h-12 sm:w-28" /><div className="flex min-w-0 items-center gap-2"><Skeleton className="h-9 w-9 rounded-full sm:h-12 sm:w-12" /><Skeleton className="h-5 w-12 sm:w-20" /></div></div></section>
      <div className="grid grid-cols-5 gap-1 rounded-xl bg-[var(--ui-card-bg)] p-1">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-8 w-full rounded-lg" />)}</div>
      <div className="flex gap-2">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-9 w-20 rounded-lg" />)}</div>
      <MatchSetSkeleton />
    </LoadingMain>
  );
}

export function FanHomeLoadingSkeleton() {
  return (
    <LoadingMain className="fan-page-container flex flex-col gap-6 py-5 md:py-9">
      <section><SectionTitle width="w-20" /><div className="mt-3 overflow-hidden rounded-xl border border-[var(--ui-border)]"><MatchRowSkeleton /></div></section>
      <section><SectionTitle width="w-16" /><div className="mt-3 overflow-hidden rounded-xl border border-[var(--ui-border)]"><TableRows count={5} /></div></section>
      <section><SectionTitle width="w-20" /><div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="aspect-[3/4] w-full rounded-none" />)}</div></section>
      <section><SectionTitle width="w-20" /><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index}><Skeleton className="aspect-video w-full rounded-xl" /><Skeleton className="mt-2 h-4 w-4/5" /></div>)}</div></section>
      <section><SectionTitle width="w-16" /><div className="mt-3 flex gap-2.5 overflow-hidden">{Array.from({ length: 5 }, (_, index) => <div key={index} className="flex min-w-[106px] flex-col items-center gap-2 rounded-xl border border-[var(--ui-border)] p-3"><Skeleton className="h-11 w-11 rounded-full" /><Skeleton className="h-3 w-12" /></div>)}</div></section>
    </LoadingMain>
  );
}

export function FanMatchesLoadingSkeleton() {
  return (
    <LoadingMain className="fan-page-container flex flex-col gap-6 py-5 md:py-9">
      <div className="space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-7 w-28" /></div>
      <div className="flex items-center justify-between"><div className="flex gap-2"><Skeleton className="h-10 w-24 rounded-lg" /><Skeleton className="h-10 w-24 rounded-lg" /></div><Skeleton className="h-10 w-20 rounded-lg" /></div>
      <div className="flex flex-col gap-8">{Array.from({ length: 3 }, (_, day) => <section key={day}><Skeleton className="mb-3 h-6 w-24" /><div className="overflow-hidden rounded-2xl border border-[var(--ui-border)]">{Array.from({ length: day === 0 ? 3 : 2 }, (_, row) => <MatchRowSkeleton key={row} />)}</div></section>)}</div>
    </LoadingMain>
  );
}

export function FanPlayersLoadingSkeleton() {
  return (
    <LoadingMain className="fan-page-container flex flex-col py-5 md:py-9">
      <section className="grid grid-cols-2 gap-2.5 py-2 sm:grid-cols-3 md:py-4 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 10 }, (_, index) => <div key={index} className="overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"><Skeleton className="aspect-[4/5] w-full rounded-none" /><div className="space-y-2 p-3"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-2/5" /></div></div>)}</section>
    </LoadingMain>
  );
}

export function FanCommunityLoadingSkeleton() {
  return (
    <LoadingMain className="fan-page-container flex flex-col gap-5 py-7 md:py-9">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start xl:gap-6"><section><Skeleton className="community-mobile-ad h-[60px] w-full !rounded-none md:mb-4 xl:hidden" /><CommunityFeedSkeleton /></section><aside className="hidden space-y-4 xl:block"><div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"><div className="border-b border-[var(--ui-border)] p-4"><SectionTitle width="w-16" /></div><CommunityPostRows count={5} /></div><Skeleton className="h-[250px] w-full rounded-xl" /></aside></div>
    </LoadingMain>
  );
}

function CommunityPostArticleSkeleton({ fullWidth = false }: { fullWidth?: boolean }) {
  return (
    <article className={`${fullWidth ? "w-full" : "content-reading"} community-post-modal mobile-full-bleed pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:mx-auto md:pb-0`}>
      <section className="mobile-surface-section overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)]">
        <header className="px-[14px] pb-5 pt-4 md:px-8 md:pb-6 md:pt-8">
          <div className="hidden items-center justify-between gap-4 md:flex">
            <Skeleton className="h-5 w-20" />
            <div className="flex gap-2"><Skeleton className="h-9 w-9 rounded-[var(--ui-control-radius)]" /><Skeleton className="h-9 w-20 rounded-[var(--ui-control-radius)]" /></div>
          </div>
          <Skeleton className="h-[23px] w-3/4 md:mt-2 md:h-8 md:w-2/3" />
          <div className="mt-3 flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-[13px] w-28" />
              <div className="mt-1.5 flex items-center gap-1.5"><Skeleton className="h-[13px] w-20" /><Skeleton className="h-[13px] w-12" /></div>
            </div>
          </div>
        </header>

        <div className="mx-[14px] border-t border-[var(--ui-border)] md:mx-8" />

        <div className="min-h-[180px] space-y-2.5 px-[14px] py-6 md:min-h-[220px] md:px-8 md:py-9">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        <div className="flex min-h-[68px] items-center justify-between gap-3 border-y border-[var(--ui-border)] px-[14px] py-4 md:gap-4 md:px-8 md:py-6">
          <div className="flex gap-2"><Skeleton className="h-9 w-[82px] rounded-[var(--ui-control-radius)]" /><Skeleton className="h-9 w-[88px] rounded-[var(--ui-control-radius)]" /></div>
          <Skeleton className="h-5 w-11" />
        </div>

        <section aria-label="댓글 불러오는 중">
          <div className="flex items-baseline gap-1 px-[14px] py-4 md:px-8 md:py-5"><Skeleton className="h-[25px] w-9" /><Skeleton className="h-5 w-4" /></div>
          <div className="hidden px-4 pb-5 md:block md:px-8 md:pb-8"><Skeleton className="h-36 w-full rounded-[var(--ui-card-radius)]" /></div>
          <div className="divide-y divide-[var(--ui-border)] px-[14px] md:px-8">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="py-3.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <Skeleton className="h-[14px] w-24" />
                  <Skeleton className="h-[13px] w-14" />
                  <div className="ml-auto flex gap-3"><Skeleton className="h-[14px] w-12" /><Skeleton className="h-[14px] w-14" /></div>
                </div>
                <Skeleton className={`mt-2 h-[15px] ${index % 2 === 0 ? "w-4/5" : "w-3/5"}`} />
                <div className="mt-2 flex gap-3"><Skeleton className="h-[13px] w-12" /><Skeleton className="h-[13px] w-8" /></div>
              </div>
            ))}
          </div>
        </section>
      </section>
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--ui-border)] bg-[var(--page-background)] px-2.5 pb-[calc(.5rem+env(safe-area-inset-bottom))] pt-2 md:hidden">
        <div className="flex items-center gap-1.5"><Skeleton className="h-10 min-w-0 flex-1 rounded-[20px]" /><Skeleton className="h-9 w-9 shrink-0 rounded-full" /></div>
      </div>
    </article>
  );
}

function CommunityPostSidebarSkeleton() {
  return (
    <aside className="hidden w-full max-w-[300px] flex-col gap-4 xl:flex">
      <section className="overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)]">
        <div className="border-b border-[var(--ui-border)] px-4 py-3.5"><SectionTitle width="w-16" /></div>
        <div className="divide-y divide-[var(--ui-border)] px-4">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 py-3"><Skeleton className="h-4 w-3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-[13px] w-4" /></div>)}
        </div>
      </section>
      <Skeleton className="h-[250px] w-full rounded-[var(--ui-card-radius)]" />
    </aside>
  );
}

export function CommunityPostLoadingSkeleton({ scope = "hub" }: { scope?: "hub" | "team" }) {
  const team = scope === "team";
  const content = (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start xl:gap-6">
      <div className="min-w-0">
        <Skeleton className="community-mobile-ad h-[60px] w-full !rounded-none md:mb-4 xl:hidden" />
        <CommunityPostArticleSkeleton fullWidth={team} />
      </div>
      <CommunityPostSidebarSkeleton />
    </div>
  );

  if (team) {
    return <LoadingMain className="community-neutral fan-page-container flex flex-col gap-0 py-0 md:gap-5 md:py-9">{content}</LoadingMain>;
  }

  return (
    <LoadingMain className="subpage min-h-screen">
      <div className="layout-wide flex flex-col gap-0 py-0 sm:gap-5 sm:py-8">{content}</div>
    </LoadingMain>
  );
}

export function FanSocialLoadingSkeleton() {
  return (
    <LoadingMain className="fan-page-container flex flex-col py-5 md:py-9">
      <section><div className="flex items-center justify-between"><SectionTitle width="w-28" /><Skeleton className="h-9 w-24 rounded-full" /></div><div className="mt-6"><Skeleton className="mb-3 h-3 w-14" /><div className="flex gap-4 overflow-hidden">{Array.from({ length: 7 }, (_, index) => <div key={index} className="shrink-0 space-y-2"><Skeleton className="h-16 w-16 rounded-full" /><Skeleton className="mx-auto h-3 w-12" /></div>)}</div></div><div className="mt-8"><Skeleton className="mb-3 h-3 w-14" /><div className="grid grid-cols-3 gap-1 sm:grid-cols-4">{Array.from({ length: 12 }, (_, index) => <Skeleton key={index} className="aspect-[3/4] w-full rounded-none" />)}</div></div></section>
    </LoadingMain>
  );
}

export function FanVideosLoadingSkeleton() {
  return (
    <LoadingMain className="fan-page-container flex flex-col py-5 md:py-9">
      <section className="grid grid-cols-2 items-start gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-9 lg:grid-cols-3">{Array.from({ length: 9 }, (_, index) => <div key={index}><Skeleton className="aspect-video w-full rounded-lg sm:rounded-xl" /><div className="mt-2 flex gap-3 sm:mt-3"><Skeleton className="hidden h-9 w-9 rounded-full sm:block" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-2/5" /></div></div></div>)}</section>
    </LoadingMain>
  );
}

export function FanInfoLoadingSkeleton() {
  return (
    <LoadingMain className="fan-page-container flex flex-col gap-5 py-5 md:gap-6 md:py-9">
      <div className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-7 w-24" /></div>
      <div className="overflow-hidden rounded-xl border border-[var(--ui-border)]"><div className="grid grid-cols-[160px_minmax(0,1fr)] gap-4 border-b border-[var(--ui-border)] p-4"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-20" /></div>{Array.from({ length: 4 }, (_, index) => <div key={index} className="grid min-h-14 grid-cols-[160px_minmax(0,1fr)] items-center gap-4 border-b border-[var(--ui-border)] p-4 last:border-b-0"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-3/5" /></div>)}</div>
    </LoadingMain>
  );
}

export function FanOnionLoadingSkeleton() {
  return (
    <LoadingMain className="fan-page-container flex flex-col gap-6 py-5 md:py-9">
      <div className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-7 w-24" /></div>
      <section className="flex min-h-[460px] flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)]"><header className="flex items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-surface)] p-5"><div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-72 max-w-full" /></div><Skeleton className="h-8 w-16" /></header><div className="flex flex-1 flex-col-reverse gap-3 p-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className={`h-10 rounded-2xl ${index % 2 === 0 ? "w-3/5" : "w-2/5"}`} />)}</div><footer className="border-t border-[var(--ui-border)] bg-[var(--ui-surface)] p-4"><Skeleton className="h-10 w-full rounded-xl" /></footer></section>
    </LoadingMain>
  );
}

export function DetailLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col gap-6 py-6 sm:py-9">
      <div className="flex items-center gap-4"><Skeleton className="h-20 w-20 rounded-2xl" /><div className="flex-1 space-y-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-52 max-w-full" /><Skeleton className="h-4 w-36" /></div></div>
      <div className="flex gap-2 border-b border-[var(--ui-border)] pb-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-9 w-20 rounded-lg" />)}</div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><section className="space-y-4"><Skeleton className="h-56 w-full rounded-2xl" /><div className="overflow-hidden rounded-xl border border-[var(--ui-border)]"><TableRows count={6} /></div></section><aside className="space-y-4"><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></aside></div>
    </LoadingMain>
  );
}

export function PlayerDetailLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col gap-7 pb-16 pt-6 sm:pt-8 md:gap-12">
      <div className="flex items-start gap-4 md:hidden">
        <Skeleton className="h-20 w-20 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-36 max-w-full" />
          <div className="flex items-center justify-between gap-3 pt-0.5"><Skeleton className="h-6 w-20" /><Skeleton className="h-8 w-20 rounded-full" /></div>
        </div>
      </div>
      <div className="hidden md:block"><Skeleton className="h-8 w-52 max-w-full" /></div>
      <Skeleton className="h-11 w-full rounded-xl md:hidden" />
      <div className="flex min-h-[76px] flex-wrap items-center gap-4 rounded-2xl border border-[var(--ui-border)] px-5 py-3.5">
        <Skeleton className="h-[30px] w-20" /><Skeleton className="h-5 w-14" /><Skeleton className="h-5 w-32" />
      </div>
      <div className="grid gap-5 min-[1200px]:grid-cols-[330px_1fr] min-[1200px]:gap-10">
        <Skeleton className="hidden h-64 w-full rounded-2xl md:block min-[1200px]:!h-[323px]" />
        <section>
          <div className="mb-3 flex items-end justify-between gap-3"><SectionTitle width="w-20" /><Skeleton className="h-3 w-36" /></div>
          <Skeleton className="mx-auto h-[280px] w-[280px] rounded-full" />
        </section>
      </div>
      <section><SectionTitle width="w-20" /><Skeleton className="mt-3 h-[86px] w-full rounded-lg" /></section>
    </LoadingMain>
  );
}

export function MatchSetSkeleton() {
  return (
    <div className="flex w-full flex-col gap-5" aria-label="세트 데이터 불러오는 중" aria-busy="true">
      <section><div className="mb-3 flex items-end justify-between"><SectionTitle width="w-24" /><Skeleton className="h-3 w-20" /></div><div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"><div className="grid grid-cols-2 gap-2 p-2 sm:gap-3 sm:p-3">{Array.from({ length: 2 }, (_, index) => <div key={index} className="flex items-center gap-2 rounded-md bg-[var(--ui-card-bg)] px-2.5 py-2.5"><Skeleton className="h-8 w-8 rounded-full sm:h-10 sm:w-10" /><div className="min-w-0 flex-1 space-y-1.5"><Skeleton className="h-3 w-4/5" /><Skeleton className="h-2.5 w-8" /></div><Skeleton className="h-6 w-5" /></div>)}</div><div className="grid grid-cols-2 gap-2 bg-[var(--ui-surface-muted)]/20 px-2 py-3">{Array.from({ length: 2 }, (_, side) => <div key={side} className="grid grid-cols-5 gap-1">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="aspect-square w-full rounded" />)}</div>)}</div><div className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center border-t border-[var(--ui-border)] px-2 py-3"><div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-5 w-full" />)}</div><Skeleton className="mx-auto h-3 w-10" /><div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-5 w-full" />)}</div></div><div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-center border-t border-[var(--ui-border)] px-2 py-3"><Skeleton className="h-2 w-full" /><Skeleton className="mx-auto h-3 w-8" /><Skeleton className="h-2 w-full" /></div></div></section>
      <section><SectionTitle width="w-20" /><div className="mt-4 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">{Array.from({ length: 10 }, (_, index) => <div key={index} className="grid grid-cols-[2rem_minmax(0,1fr)_3.5rem] items-center gap-2 border-b border-[var(--ui-border)] px-3 py-2 last:border-b-0 sm:grid-cols-[2rem_minmax(0,1fr)_4rem_4rem_5rem]"><Skeleton className="h-8 w-8 rounded-full" /><div className="space-y-1.5"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-2.5 w-1/2" /></div><Skeleton className="h-3.5 w-full" /><Skeleton className="hidden h-3.5 w-full sm:block" /><Skeleton className="hidden h-5 w-full sm:block" /></div>)}</div></section>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
