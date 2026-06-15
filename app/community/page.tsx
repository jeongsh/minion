import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { communityNavItems } from "@/lib/navigation";

export default function CommunityPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="커뮤니티" title="커뮤니티" />
      <section className="page-grid" aria-label="커뮤니티 게시판">
        {communityNavItems.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-md border border-border bg-surface p-4 hover:bg-surface-muted">
            <h2 className="text-lg font-semibold">{item.label}</h2>
          </Link>
        ))}
      </section>
    </main>
  );
}
