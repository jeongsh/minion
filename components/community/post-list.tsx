import { Eye, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { formatRelativeOrDate } from "@/components/community/format";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import { isHotPost } from "@/lib/community/hot";
import type { CommunityPostDetail } from "@/lib/community/types";

export function PostList({ posts, scope, teamSlug }: { posts: CommunityPostDetail[]; scope: BoardScope; teamSlug?: string }) {
  const detailHref = (postId: string) => scope === "team" && teamSlug
    ? `/fan/${teamSlug}/community/post/${postId}`
    : `/community/post/${postId}`;

  if (posts.length === 0) {
    return <p className="py-20 text-center text-[14px] text-[var(--ui-muted)]">조건에 맞는 게시글이 없습니다.</p>;
  }

  return (
    <ul className="px-4">
      {posts.map((post) => (
        <li key={post.id} className="border-b border-[var(--ui-border)] last:border-b-0">
          <Link
            href={detailHref(post.id)}
            className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 transition-colors sm:px-2"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                {isHotPost(post) ? (
                  <span className="shrink-0 rounded-full border border-[var(--tp)] px-1.5 py-0.5 text-[12px] font-semibold leading-none text-[var(--tp)]">인기</span>
                ) : null}
                <h3 className="truncate text-[16px] font-medium text-[var(--ui-ink)]">{post.title}</h3>
                <span className="shrink-0 text-m font-semibold text-[var(--tp)]">[{post.commentCount}]</span>
              </div>

              <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[13px] font-normal text-[var(--ui-muted)]">
                <span className="shrink-0 text-[var(--tp)]">{boardLabel(scope, post.boardType)}</span>
                <span aria-hidden>·</span>
                <span className="max-w-28 truncate font-medium text-[var(--ui-text)]">{post.authorName ?? "알 수 없음"}</span>
                <span aria-hidden>·</span>
                <span className="shrink-0">{formatRelativeOrDate(post.createdAt)}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex shrink-0 items-center gap-1"><Eye size={13} strokeWidth={1.8} />{post.viewCount}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex shrink-0 items-center gap-1"><ThumbsUp size={13} strokeWidth={1.8} />{post.likeCount}</span>
              </div>
            </div>

            {post.thumbnailUrl ? (
              <span className="h-[48px] w-[72px] shrink-0 overflow-hidden rounded-[var(--ui-control-radius)] bg-[var(--ui-surface-muted)] sm:h-[54px] sm:w-[88px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
