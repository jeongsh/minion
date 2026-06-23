import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import type { NavItem } from "@/lib/navigation";

export function StaticRoutePage({
  eyebrow,
  title,
  items,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  items?: NavItem[];
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow={eyebrow} title={title} />
      {items ? (
        <section className="page-grid" aria-label={`${title} 하위 메뉴`}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-border bg-surface p-4 hover:bg-surface-muted"
            >
              <span className="font-semibold">{item.label}</span>
            </Link>
          ))}
        </section>
      ) : null}
    </main>
  );
}
