import Link from "next/link";

import { SectionHeader } from "@/components/layout/section-header";
import { hubBoards } from "@/lib/community/boards";

export default function CommunityPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="커뮤니티" title="커뮤니티" />
      <section className="page-grid" aria-label="커뮤니티 게시판">
        {hubBoards.map((board) => (
          <Link
            key={board.slug}
            href={`/community/${board.slug}`}
            className="rounded-md border border-border bg-surface p-4 hover:bg-surface-muted"
          >
            <h2 className="text-lg font-semibold">{board.label}</h2>
          </Link>
        ))}
      </section>
    </main>
  );
}
