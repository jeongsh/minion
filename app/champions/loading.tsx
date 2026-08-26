function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-[var(--ui-surface-muted)] ${className}`} />;
}

export default function ChampionsLoading() {
  return (
    <main className="layout-wide min-h-screen pb-16 pt-6 text-[var(--ui-text)] sm:pt-8">
      <div className="flex items-center justify-between">
        <Pulse className="h-9 w-28" />
        <Pulse className="h-5 w-12" />
      </div>
      <div className="mt-7 grid md:grid-cols-[180px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <Pulse className="hidden h-96 w-full md:block" />
        <div>
          <Pulse className="ml-auto h-10 w-[25rem] max-w-full" />
          <div className="mt-5 grid grid-cols-5 gap-x-2 gap-y-4 sm:grid-cols-7 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {Array.from({ length: 30 }, (_, index) => (
              <div key={index} className="flex flex-col items-center gap-2 py-2">
                <Pulse className="h-14 w-14" />
                <Pulse className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
