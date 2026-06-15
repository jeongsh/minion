import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { statsNavItems } from "@/lib/navigation";

const filters = ["현재 구간", "2026 LCK 통합", "대회별", "국제 / 이벤트", "커리어"];

export default function StatsPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="스탯" title="스탯" />
      <section className="flex flex-col gap-4" aria-labelledby="stats-filter">
        <h2 id="stats-filter" className="text-xl font-semibold">
          기준 필터
        </h2>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
            >
              {filter}
            </button>
          ))}
        </div>
      </section>
      <section className="page-grid" aria-label="스탯 화면">
        {statsNavItems.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-md border border-border bg-surface p-4 hover:bg-surface-muted">
            <h2 className="text-lg font-semibold">{item.label}</h2>
          </Link>
        ))}
      </section>
    </main>
  );
}
