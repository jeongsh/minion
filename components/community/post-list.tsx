import Link from "next/link";

import { DataTable } from "@/components/ui/data-table";
import { formatRelativeOrDate } from "@/components/community/format";
import type { BoardScope } from "@/lib/community/boards";
import type { CommunityPostDetail } from "@/lib/community/types";

// 보드별 글 목록(제목/명예수/댓글수/조회수/시간).
// 제목 클릭 시 상세로 이동. 상세 경로는 scope/teamSlug 기반.
export function PostList({
  posts,
  scope,
  teamSlug,
}: {
  posts: CommunityPostDetail[];
  scope: BoardScope;
  teamSlug?: string;
}) {
  const detailHref = (postId: string) =>
    scope === "team" && teamSlug
      ? `/fan/${teamSlug}/community/post/${postId}`
      : `/community/post/${postId}`;

  return (
    <DataTable
      rows={posts}
      emptyText="아직 게시글이 없습니다. 첫 글을 작성해 보세요."
      columns={[
        {
          key: "title",
          label: "제목",
          cellClassName: "font-medium",
          render: (row) => (
            <Link href={detailHref(row.id)} className="hover:underline">
              {row.title}
            </Link>
          ),
        },
        { key: "honor", label: "명예", render: (row) => row.likeCount },
        { key: "comments", label: "댓글", render: (row) => row.commentCount },
        { key: "views", label: "조회", render: (row) => row.viewCount },
        {
          key: "created",
          label: "작성",
          render: (row) => formatRelativeOrDate(row.createdAt),
        },
      ]}
    />
  );
}
