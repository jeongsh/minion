import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getCommunityPosts, getTeams } from "@/lib/data/lck";
import { teamLabel } from "@/lib/view-data";

export default async function CommunityReviewsPage() {
  const [posts, teams] = await Promise.all([getCommunityPosts(), getTeams()]);
  const rows = posts.filter((post) => post.boardType === "reviews");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="커뮤니티" title="경기 리뷰" />
      <DataTable
        rows={rows}
        columns={[
          { key: "scope", label: "범위", render: (row) => row.teamId ? teamLabel(teams, row.teamId) : "허브" },
          { key: "review", label: "리뷰", render: (row) => row.title },
          { key: "comments", label: "댓글", render: (row) => row.commentCount },
          { key: "likes", label: "추천", render: (row) => row.likeCount },
          { key: "views", label: "조회", render: (row) => row.viewCount },
        ]}
      />
    </main>
  );
}
