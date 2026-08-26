function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-[var(--ui-surface-muted)] ${className}`} />;
}

export default function ChampionDetailLoading() {
  return (
    <main className="layout-wide min-h-screen pb-16 pt-6 text-[var(--ui-text)] sm:pt-8">
      <Pulse className="h-16 w-full" />
      <section className="mt-4 rounded-2xl bg-[var(--ui-surface)] p-5">
        <div className="flex gap-4">
          <Pulse className="h-20 w-20 shrink-0" />
          <Pulse className="h-20 w-64" />
          <div className="ml-auto grid flex-1 grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, index) => <Pulse key={index} className="h-20 w-full" />)}
          </div>
        </div>
        <Pulse className="mt-5 h-10 w-96 max-w-full" />
      </section>
      <Pulse className="mt-5 h-11 w-[34rem] max-w-full" />
      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Pulse className="h-[26rem] w-full" />
          <Pulse className="h-[24rem] w-full" />
        </div>
        <Pulse className="h-[30rem] w-full" />
      </div>
    </main>
  );
}
