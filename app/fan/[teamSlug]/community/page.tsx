import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getCommunityPosts, getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { fanCommunityNavItems } from "@/lib/navigation";

export default async function FanCommunityPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const posts = (await getCommunityPosts()).filter(
    (post) => post.siteScope === "team" && post.teamId === team.id,
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow={team.shortName} title="팀 팬 커뮤니티" />
      <section className="flex flex-wrap gap-2" aria-label="팀 커뮤니티 게시판">
        {fanCommunityNavItems(teamSlug).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
          >
            {item.label}
          </Link>
        ))}
      </section>
      <DataTable
        rows={posts}
        columns={[
          { key: "board", label: "게시판", render: (row) => row.boardType },
          { key: "title", label: "제목", render: (row) => row.title },
          { key: "likes", label: "추천", render: (row) => row.likeCount },
          { key: "comments", label: "댓글", render: (row) => row.commentCount },
          { key: "views", label: "조회", render: (row) => row.viewCount },
        ]}
      />
    </main>
  );
}
