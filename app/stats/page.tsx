import Link from "next/link";
import { Suspense } from "react";

import { SeasonSegmentFilter } from "@/components/domain/season-segment-filter";
import { statsNavItems } from "@/lib/navigation";
import { parseSeasonSegment, segmentLabel } from "@/lib/tournament-filters";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const params = await searchParams;
  const activeSegment = parseSeasonSegment(params.segment);
  const segmentQuery = activeSegment === "all" ? "" : `?segment=${activeSegment}`;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">스탯</p>
        <h1 className="text-3xl font-bold">{segmentLabel(activeSegment)} 스탯</h1>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="stats-filter">
        <h2 id="stats-filter" className="text-xl font-semibold">
          대회 구간
        </h2>
        <Suspense fallback={null}>
          <SeasonSegmentFilter activeSegment={activeSegment} basePath="/stats" />
        </Suspense>
      </section>

      <section className="page-grid" aria-label="스탯 화면">
        {statsNavItems.map((item) => (
          <Link
            key={item.href}
            href={`${item.href}${segmentQuery}`}
            className="rounded-md border border-border bg-surface p-4 hover:bg-surface-muted"
          >
            <h2 className="text-lg font-semibold">{item.label}</h2>
          </Link>
        ))}
      </section>
    </main>
  );
}
