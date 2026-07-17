import { Eye, ThumbsUp, MessageCircle, Megaphone, EyeOff } from "lucide-react";
import Link from "next/link";

import { formatRelativeOrDate } from "@/components/community/format";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import { isHotPost } from "@/lib/community/hot";
import type { CommunityPostDetail } from "@/lib/community/types";

export function PostList({
  posts,
  pinned = [],
  scope,
  teamSlug,
}: {
  posts: CommunityPostDetail[];
  /** 공지 등 필터/페이징과 무관하게 최상단에 고정할 글. */
  pinned?: CommunityPostDetail[];
  scope: BoardScope;
  teamSlug?: string;
}) {
  const detailHref = (postId: string) => scope === "team" && teamSlug
    ? `/fan/${teamSlug}/community/post/${postId}`
    : `/community/post/${postId}`;

  if (posts.length === 0 && pinned.length === 0) {
    return <p className="py-20 text-center text-sm text-[var(--ui-muted)]">조건에 맞는 게시글이 없습니다.</p>;
  }

  const row = (post: CommunityPostDetail, isNoticeRow: boolean) => {
    const blinded = Boolean(post.blindedAt);

    return (
      <li key={post.id} className={`border-b border-[var(--ui-border)] last:border-b-0 ${isNoticeRow ? "bg-[var(--ui-surface-muted)]" : ""}`}>
        <Link
          href={detailHref(post.id)}
          className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors sm:px-2"
        >
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              {isNoticeRow ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--ui-ink)] px-2 py-0.5 text-[12px] font-semibold leading-none text-[var(--ui-surface)]">
                  <Megaphone size={11} strokeWidth={2} />공지
                </span>
              ) : (
                <span className="shrink-0 text-[13px] font-semibold text-[var(--tp)]">{boardLabel(scope, post.boardType)}</span>
              )}
              {!blinded && isHotPost(post) ? (
                <span className="shrink-0 rounded-full border border-[var(--tp)] px-1.5 py-0.5 text-[13px] font-medium leading-none text-[var(--tp)]">인기</span>
              ) : null}
              {blinded ? (
                <h3 className="inline-flex min-w-0 items-center gap-1.5 truncate text-base font-medium text-[var(--ui-muted)]">
                  <EyeOff size={14} strokeWidth={1.8} className="shrink-0" />
                  신고 누적으로 블라인드된 게시글입니다
                </h3>
              ) : (
                <h3 className="truncate text-base font-semibold text-[var(--ui-ink)]">{post.title}</h3>
              )}
            </div>

            <div className="mt-0.5 flex min-w-0 items-center gap-2.5 overflow-hidden whitespace-nowrap text-[13px] font-normal text-[var(--ui-muted)]">
              <span className="max-w-28 truncate font-medium text-[var(--ui-text)]">{post.authorName ?? "알 수 없음"}</span>
              <span className="shrink-0">{formatRelativeOrDate(post.createdAt)}</span>
              <span className="hidden shrink-0 items-center gap-1 sm:inline-flex"><Eye size={13} strokeWidth={1.8} />{post.viewCount}</span>
              <span className="inline-flex shrink-0 items-center gap-1"><MessageCircle size={13} strokeWidth={1.8} />{post.commentCount}</span>
              <span className="inline-flex shrink-0 items-center gap-1"><ThumbsUp size={13} strokeWidth={1.8} />{post.likeCount}</span>
            </div>
          </div>

          {!blinded && post.thumbnailUrl ? (
            <span className="h-[48px] w-[72px] shrink-0 overflow-hidden rounded-[var(--ui-control-radius)] bg-[var(--ui-surface-muted)] sm:h-[70px] sm:w-[120px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <ul className="px-0 sm:px-4">
      {pinned.map((post) => row(post, true))}
      {posts.map((post) => row(post, false))}
    </ul>
  );
}
