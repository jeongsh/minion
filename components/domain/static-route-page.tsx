import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import type { NavItem } from "@/lib/navigation";

export function StaticRoutePage({
  eyebrow,
  eyebrowHref,
  title,
  items,
}: {
  eyebrow?: string;
  eyebrowHref?: string;
  title: string;
  description?: string;
  items?: NavItem[];
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      {eyebrow && eyebrowHref ? (
        <div className="flex flex-col gap-2">
          <Breadcrumb items={[{ label: eyebrow, href: eyebrowHref }, { label: title }]} />
          <SectionHeader title={title} />
        </div>
      ) : (
        <SectionHeader eyebrow={eyebrow} title={title} />
      )}
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
