import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionHeader } from "@/components/layout/section-header";
import { teamBoards } from "@/lib/community/boards";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export default async function FanCommunityPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow={team.shortName} title="팀 팬 커뮤니티" />
      <section className="page-grid" aria-label="팀 커뮤니티 게시판">
        {teamBoards.map((board) => (
          <Link
            key={board.slug}
            href={`/fan/${teamSlug}/community/${board.slug}`}
            className="rounded-md border border-border bg-surface p-4 hover:bg-surface-muted"
          >
            <h2 className="text-lg font-semibold">{board.label}</h2>
          </Link>
        ))}
      </section>
    </main>
  );
}
