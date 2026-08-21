import { Skeleton } from "@/components/ui/skeleton";

function LoadingMain({ children, className = "layout-wide flex flex-col" }: { children?: React.ReactNode; className?: string }) {
  return (
    <main className={`${className} min-h-[calc(100vh-72px)]`} aria-label="페이지 콘텐츠 불러오는 중" aria-busy="true" data-route-loading="true">
      {children}
    </main>
  );
}

function SectionTitle({ width = "w-28" }: { width?: string }) {
  return <Skeleton className={`h-5 ${width}`} />;
}

function MatchRowSkeleton() {
  return (
    <div className="grid min-h-[66px] grid-cols-[48px_minmax(0,1fr)] items-center gap-2.5 border-b border-[var(--ui-border)] px-3 py-3 last:border-b-0 md:grid-cols-[140px_minmax(0,1fr)_160px] md:px-5">
      <div className="space-y-2"><Skeleton className="h-4 w-10" /><Skeleton className="h-3 w-8" /></div>
      <div className="grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] items-center gap-2">
        <div className="flex items-center justify-end gap-2"><Skeleton className="h-4 w-14" /><Skeleton className="h-8 w-8 rounded-full" /></div>
        <Skeleton className="mx-auto h-5 w-8" />
        <div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-14" /></div>
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
      <div className="border-b border-[var(--ui-border)]"><div className="layout-wide flex items-center justify-between gap-4 py-3"><div className="flex gap-2"><Skeleton className="h-9 w-9 rounded-lg" /><Skeleton className="h-9 w-28 rounded-lg" /><Skeleton className="h-9 w-9 rounded-lg" /></div><div className="hidden gap-2 md:flex"><Skeleton className="h-9 w-24 rounded-lg" /><Skeleton className="h-9 w-24 rounded-lg" /></div></div></div>
      <div className="layout-wide flex flex-col gap-8 pb-20 pt-7">
        {Array.from({ length: 3 }, (_, day) => (
          <section key={day}><div className="mb-3 flex items-center gap-2"><Skeleton className="h-6 w-24" />{day === 0 ? <Skeleton className="h-6 w-12 rounded-full" /> : null}</div><div className="overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">{Array.from({ length: day === 0 ? 3 : 2 }, (_, row) => <MatchRowSkeleton key={row} />)}</div></section>
        ))}
      </div>
    </LoadingMain>
  );
}

export function TournamentLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col gap-6 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-40" /></div></div><Skeleton className="h-10 w-24 rounded-xl" /></header>
      <div className="flex gap-2 overflow-hidden">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-10 w-24 shrink-0 rounded-xl" />)}</div>
      <div className="flex flex-col gap-3 border-b border-[var(--ui-border)] pb-3 sm:flex-row sm:items-end sm:justify-between"><div className="flex gap-5"><Skeleton className="h-9 w-20 rounded-none" /><Skeleton className="h-9 w-24 rounded-none" /><Skeleton className="h-9 w-24 rounded-none" /></div><div className="flex gap-1"><Skeleton className="h-9 w-20 rounded-lg" /><Skeleton className="h-9 w-20 rounded-lg" /><Skeleton className="h-9 w-20 rounded-lg" /></div></div>
      <section className="grid gap-4 sm:grid-cols-2"><div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"><div className="p-4"><SectionTitle /></div><TableRows count={5} /></div><div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"><div className="p-4"><SectionTitle /></div><TableRows count={5} /></div></section>
    </LoadingMain>
  );
}

export function PredictionLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col pb-20 pt-6 sm:pt-8 xl:px-10">
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
      <section className="mb-6 rounded-xl bg-[var(--ui-card-bg)] p-2.5"><div className="flex gap-2 overflow-hidden">{Array.from({ length: 9 }, (_, index) => <Skeleton key={index} className="h-9 w-20 shrink-0 rounded-md" />)}</div><div className="mt-2 flex gap-2"><Skeleton className="h-10 flex-1 rounded-md" /><Skeleton className="h-10 w-16 rounded-md" /></div></section>
      <div className="mb-4 flex items-end gap-3"><SectionTitle width="w-24" /><Skeleton className="h-3 w-14" /></div>
      <div className="divide-y divide-[var(--ui-border)]">{Array.from({ length: 7 }, (_, index) => <article key={index} className="grid grid-cols-[minmax(0,1fr)_112px] gap-4 py-4 sm:grid-cols-[180px_minmax(0,1fr)]"><Skeleton className="order-2 aspect-video w-full rounded-lg sm:order-1" /><div className="order-1 space-y-2 sm:order-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-2/5" /></div></article>)}</div>
    </LoadingMain>
  );
}

export function CommunityLoadingSkeleton() {
  return (
    <LoadingMain className="layout-wide flex flex-col gap-5 pb-6 pt-6 sm:py-8">
      <div className="flex gap-2 overflow-hidden">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-10 w-20 shrink-0 rounded-lg" />)}</div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"><section><div className="mb-3 flex justify-between"><SectionTitle width="w-20" /><Skeleton className="h-10 w-24 rounded-xl" /></div><div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"><TableRows count={9} /></div><div className="mt-4 flex gap-2"><Skeleton className="h-10 flex-1 rounded-lg" /><Skeleton className="h-10 w-16 rounded-lg" /></div></section><aside className="hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 lg:block"><SectionTitle width="w-20" /><div className="mt-3"><TableRows count={5} /></div></aside></div>
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
      <section className="overflow-hidden rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)]"><div className="flex justify-between px-4 py-3"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-24" /></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-5"><div className="flex items-center justify-end gap-3"><Skeleton className="h-5 w-20" /><Skeleton className="h-12 w-12 rounded-full" /></div><Skeleton className="h-12 w-24 rounded-xl" /><div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-full" /><Skeleton className="h-5 w-20" /></div></div></section>
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
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-6"><section><Skeleton className="mb-4 h-[60px] w-full rounded-xl xl:hidden" /><div className="overflow-hidden rounded-xl border border-[var(--ui-border)]"><div className="flex items-center gap-2 border-b border-[var(--ui-border)] p-3"><Skeleton className="h-9 w-32 rounded-lg" /><Skeleton className="ml-auto h-9 w-52 rounded-lg" /><Skeleton className="h-9 w-20 rounded-lg" /></div><TableRows count={9} /></div></section><aside className="hidden space-y-4 xl:block"><div className="overflow-hidden rounded-xl border border-[var(--ui-border)]"><div className="p-4"><SectionTitle width="w-16" /></div><TableRows count={5} /></div><Skeleton className="h-[250px] w-full rounded-xl" /></aside></div>
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

export function MatchSetSkeleton() {
  return (
    <div className="flex w-full flex-col gap-5" aria-label="세트 데이터 불러오는 중" aria-busy="true">
      <section className="overflow-hidden rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)]"><div className="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-16" /></div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-5 sm:px-6"><div className="flex justify-end gap-2">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-9 w-9 rounded" />)}</div><Skeleton className="h-10 w-20 rounded-lg" /><div className="flex gap-2">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-9 w-9 rounded" />)}</div></div></section>
      <section className="overflow-hidden rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)]"><div className="grid grid-cols-2 gap-3 border-b border-[var(--ui-border)] p-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>{Array.from({ length: 5 }, (_, index) => <div key={index} className="grid grid-cols-[2rem_minmax(5rem,1fr)_4rem_4rem_5rem] items-center gap-2 border-b border-[var(--ui-border)] px-3 py-2 last:border-b-0"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-full" /><div className="flex gap-1">{Array.from({ length: 3 }, (_, itemIndex) => <Skeleton key={itemIndex} className="h-5 w-5 rounded" />)}</div></div>)}</section>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
