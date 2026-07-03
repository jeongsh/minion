import Link from "next/link";

import { formatListDate } from "@/components/community/format";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import type { CommunityPostDetail } from "@/lib/community/types";

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

  if (posts.length === 0) {
    return (
      <p className="rounded-[14px] border border-[#e4e8ef] bg-white p-8 text-center text-[12px] text-[#8a93a6]">
        아직 게시글이 없습니다. 첫 글을 작성해 보세요.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-[#e4e8ef] bg-white shadow-[0_6px_24px_-12px_rgba(20,30,60,0.18),0_1px_2px_rgba(20,30,60,0.04)]">
      <table className="w-full min-w-[760px] table-fixed text-[14px]">
        <colgroup>
          <col className="w-[100px]" />
          <col />
          <col className="w-[120px]" />
          <col className="w-[118px]" />
          <col className="w-[72px]" />
          <col className="w-[72px]" />
        </colgroup>
        <thead className="border-b border-[#e8ebf1] bg-[#f7f9fc] text-[12px] font-semibold text-[#69738a]">
          <tr>
            <th className="px-4 py-3 text-left">말머리</th>
            <th className="px-4 py-3 text-left">제목</th>
            <th className="px-4 py-3 text-left">글쓴이</th>
            <th className="px-4 py-3 text-center">날짜</th>
            <th className="px-4 py-3 text-center">명예</th>
            <th className="px-4 py-3 text-center">조회수</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} className="border-b border-[#f0f2f6] last:border-b-0 hover:bg-[#f7f9fc]">
              <td className="px-4 py-[13px] text-[#69738a]">{boardLabel(scope, post.boardType)}</td>
              <td className="px-4 py-[13px]">
                <Link href={detailHref(post.id)} className="block truncate font-semibold text-[#151b2b] hover:underline">
                  {post.title}
                </Link>
              </td>
              <td className="truncate px-4 py-[13px] text-[#56607a]">{post.authorName ?? "알 수 없음"}</td>
              <td className="px-4 py-[13px] text-center text-[#8a93a6]">{formatListDate(post.createdAt)}</td>
              <td className="px-4 py-[13px] text-center text-[#56607a]">{post.likeCount}</td>
              <td className="px-4 py-[13px] text-center text-[#8a93a6]">{post.viewCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
