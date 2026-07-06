import Link from "next/link";

import { formatListDate } from "@/components/community/format";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import { isHotPost } from "@/lib/community/hot";
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
      <p className="border-t-2 border-[var(--ink,#16151b)] py-14 text-center text-[14px] text-[var(--sub-muted,#9c9aa3)]">
        게시글이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] table-fixed text-[14px]">
        <colgroup>
          <col className="w-[112px]" />
          <col />
          <col className="w-[110px]" />
          <col className="w-[84px]" />
          <col className="w-[64px]" />
          <col className="w-[64px]" />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-[var(--ink,#16151b)] text-[12px] font-semibold text-[var(--sub-muted-weak,#b6b4bd)]">
            <th className="px-3 py-2.5 text-left font-semibold">말머리</th>
            <th className="px-3 py-2.5 text-left font-semibold">제목</th>
            <th className="px-3 py-2.5 text-left font-semibold">글쓴이</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">날짜</th>
            <th className="px-3 py-2.5 text-center font-semibold">추천</th>
            <th className="px-3 py-2.5 text-center font-semibold">조회</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const hot = isHotPost(post);
            return (
              <tr key={post.id} className="row-hover-soft border-b border-[var(--hairline,#f2f0ec)]">
                <td className="px-3 py-[13px]">
                  <span className="inline-flex rounded-[4px] bg-[var(--surface-1,#f2f0ec)] px-2 py-[3px] text-[12px] text-[var(--ink-2,#6d6c76)]">
                    {boardLabel(scope, post.boardType)}
                  </span>
                </td>
                <td className="px-3 py-[13px]">
                  <Link href={detailHref(post.id)} className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-bold text-[var(--ink,#16151b)] group-hover:underline">
                      {post.title}
                    </span>
                    {hot ? (
                      <span className="shrink-0 rounded-[4px] bg-[var(--ink,#16151b)] px-1.5 py-[1px] text-[11px] font-bold text-[var(--background)]">
                        HOT
                      </span>
                    ) : null}
                    {post.commentCount > 0 ? (
                      <span className="shrink-0 text-[12px] font-semibold text-[var(--sub-muted,#9c9aa3)]">
                        [{post.commentCount}]
                      </span>
                    ) : null}
                  </Link>
                </td>
                <td className="truncate px-3 py-[13px] text-[var(--ink-2,#6d6c76)]">
                  {post.authorName ?? "알 수 없음"}
                </td>
                <td className="whitespace-nowrap px-3 py-[13px] text-center text-[12px] text-[var(--sub-muted,#9c9aa3)]">
                  {formatListDate(post.createdAt)}
                </td>
                <td className="px-3 py-[13px] text-center font-semibold text-[var(--tp)]">
                  {post.likeCount}
                </td>
                <td className="px-3 py-[13px] text-center text-[12px] text-[var(--sub-muted,#9c9aa3)]">
                  {post.viewCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
