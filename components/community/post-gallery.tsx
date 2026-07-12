import Link from "next/link";

import { formatRelativeOrDate } from "@/components/community/format";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import { isHotPost } from "@/lib/community/hot";
import type { CommunityPostDetail } from "@/lib/community/types";

export function PostGallery({
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
      <p className="rounded-[14px] border border-[var(--ui-border)] bg-white p-8 text-center text-[13px] text-[var(--ui-muted)] dark:bg-[var(--ui-surface-muted)]">
        아직 게시글이 없습니다. 첫 글을 작성해 보세요.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-[14px] border border-[var(--ui-border)] bg-[var(--ui-surface)]">
      {posts.map((post) => (
        <li key={post.id} className="border-b border-[var(--ui-border)] last:border-b-0">
          <Link
            href={detailHref(post.id)}
            className="grid grid-cols-[88px_1fr] items-center gap-[14px] px-4 py-3 transition-colors hover:bg-[var(--ui-surface-muted)]"
          >
            <div className="h-[56px] w-[88px] overflow-hidden rounded-[9px] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)]">
              {post.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2">
                  <p className="line-clamp-3 text-center text-[13px] leading-tight text-[var(--ui-muted)]">
                    {post.excerpt || "내용 없음"}
                  </p>
                </div>
              )}
            </div>

            <div className="grid h-[56px] min-w-0 grid-rows-[16px_16px_16px] content-between">
              <div className="flex items-center gap-[5px]">
                <span className="inline-flex rounded-[4px] bg-[var(--surface-1,#f2f0ec)] px-2 py-[3px] text-[13px] font-semibold leading-none text-[var(--ink-2,#6d6c76)]">
                  {boardLabel(scope, post.boardType)}
                </span>
                {isHotPost(post) && (
                  <span className="inline-flex rounded-[4px] bg-[var(--ink,#16151b)] px-1.5 py-[1px] text-[13px] font-medium leading-none text-[var(--background)]">
                    HOT
                  </span>
                )}
              </div>
              <h3 className="h-5 truncate text-[15px] font-extrabold leading-5 text-[var(--ui-ink)]">{post.title}</h3>
              <div className="flex h-[16px] items-center gap-x-2 overflow-hidden whitespace-nowrap text-[13px] font-semibold leading-[16px] text-[var(--ui-muted)]">
                <span>{formatRelativeOrDate(post.createdAt)}</span>
                <span aria-hidden>·</span>
                <span>명예 {post.likeCount}</span>
                <span aria-hidden>·</span>
                <span>댓글 {post.commentCount}</span>
                <span aria-hidden>·</span>
                <span>조회 {post.viewCount}</span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
