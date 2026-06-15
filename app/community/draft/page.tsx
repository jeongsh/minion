import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getChampions, getCommunityPosts, getSetPicksBans, getTeams } from "@/lib/data/lck";
import { teamLabel } from "@/lib/view-data";

export default async function CommunityDraftPage() {
  const [posts, picksBans, champions, teams] = await Promise.all([
    getCommunityPosts(),
    getSetPicksBans(),
    getChampions(),
    getTeams(),
  ]);
  const rows = posts.filter((post) => post.boardType === "draft").map((post, index) => {
    const draft = picksBans[index];
    return {
      post,
      draft,
      champion: draft ? champions.find((champion) => champion.id === draft.championId) : null,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="커뮤니티" title="밴픽 토론" />
      <DataTable
        rows={rows}
        columns={[
          { key: "order", label: "밴픽 순서", render: (row) => row.draft?.orderIndex ?? "-" },
          { key: "champion", label: "챔피언", render: (row) => row.champion?.name ?? "-" },
          { key: "team", label: "팀", render: (row) => row.draft ? teamLabel(teams, row.draft.teamId) : "-" },
          { key: "title", label: "토론글", render: (row) => row.post.title },
          { key: "comments", label: "댓글", render: (row) => row.post.commentCount },
        ]}
      />
    </main>
  );
}
