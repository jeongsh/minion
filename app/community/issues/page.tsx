import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getCommunityPosts } from "@/lib/data/lck";

export default async function CommunityIssuesPage() {
  const rows = (await getCommunityPosts()).filter((post) => post.boardType === "issues");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="커뮤니티" title="LCK 이슈" />
      <DataTable
        rows={rows}
        columns={[
          { key: "title", label: "이슈", render: (row) => row.title },
          { key: "content", label: "내용", render: (row) => row.content },
          { key: "comments", label: "댓글", render: (row) => row.commentCount },
          { key: "likes", label: "추천", render: (row) => row.likeCount },
          { key: "views", label: "조회", render: (row) => row.viewCount },
        ]}
      />
    </main>
  );
}
