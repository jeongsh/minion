import { Eye, ThumbsUp, MessageCircle, Megaphone, EyeOff } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import cleansingBotWarning from "@/assets/characters/pen-warning-blocked-red.png";
import { AuthorMenu } from "@/components/community/author-menu";
import { formatRelativeOrDate } from "@/components/community/format";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import { isHotPost } from "@/lib/community/hot";
import { blindLabel } from "@/lib/community/moderation-labels";
import type { CommunityPostDetail } from "@/lib/community/types";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";

export function PostList({
  posts,
  pinned = [],
  scope,
  teamSlug,
  viewerId,
}: {
  posts: CommunityPostDetail[];
  /** 공지 등 필터/페이징과 무관하게 최상단에 고정할 글. */
  pinned?: CommunityPostDetail[];
  scope: BoardScope;
  teamSlug?: string;
  viewerId?: string | null;
}) {
  const detailHref = (postId: string) => scope === "team" && teamSlug
    ? `/fan/${teamSlug}/community/post/${postId}`
    : `/community/post/${postId}`;

  if (posts.length === 0 && pinned.length === 0) {
    return (
      <KitschEmptyState
        character="marker"
        title="이 말머리엔 아직 조용해요"
        body="필터를 바꾸거나 첫 글을 톡 올려보세요."
        animated
        plain
      />
    );
  }

  const row = (post: CommunityPostDetail, isNoticeRow: boolean) => {
    const blinded = Boolean(post.blindedAt);
    const cleansingBotBlinded = post.blindedSource === "ai";

    return (
      <li key={post.id} className={`relative border-b border-[var(--ui-border)] last:border-b-0 ${isNoticeRow ? "bg-[var(--ui-surface-muted)]" : ""}`}>
        <Link
          href={detailHref(post.id)}
          className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--tp)]"
          aria-label={`${blinded ? blindLabel(post.blindedSource, "post") : post.title} 게시글 보기`}
        />
        <div
          className="pointer-events-none relative z-[1] grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-2"
        >
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              {isNoticeRow ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--ui-ink)] px-2 py-0.5 text-[12px] font-medium leading-none text-[var(--ui-surface)]">
                  <Megaphone size={11} strokeWidth={2} />공지
                </span>
              ) : (
                <span className="shrink-0 text-[13px] font-semibold text-[var(--tp)]">{boardLabel(scope, post.boardType)}</span>
              )}
              {!blinded && isHotPost(post) ? (
                <span className="shrink-0 rounded-full border border-[var(--tp)] px-1.5 py-0.5 text-[13px] font-medium leading-none text-[var(--tp)]">인기</span>
              ) : null}
              {blinded ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-base font-medium text-[var(--ui-muted)]">
                  {cleansingBotBlinded ? (
                    <Image
                      src={cleansingBotWarning}
                      alt=""
                      width={24}
                      height={24}
                      className="-my-1 h-6 w-6 shrink-0 object-contain"
                      aria-hidden
                    />
                  ) : (
                    <EyeOff size={14} strokeWidth={1.8} className="shrink-0" />
                  )}
                  {blindLabel(post.blindedSource, "post")}
                </span>
              ) : (
                <span className="truncate text-base font-semibold text-[var(--ui-ink)]">{post.title}</span>
              )}
            </div>

            <div className="mt-0.5 flex min-w-0 items-center gap-2.5 overflow-hidden whitespace-nowrap text-[13px] font-normal text-[var(--ui-muted)]">
              <span className="pointer-events-auto relative z-10 inline-flex min-w-0">
                <AuthorMenu authorId={post.authorId} authorName={post.authorName} authorImageUrl={post.authorImageUrl} authorTier={post.authorTier} guestKey={post.guestKey} viewerId={viewerId} variant="feed" evidencePostId={post.id} scope={scope} teamSlug={teamSlug} />
              </span>
              <span className="shrink-0">{formatRelativeOrDate(post.createdAt)}</span>
              <span className="hidden shrink-0 items-center gap-1 sm:inline-flex"><Eye size={13} strokeWidth={1.8} />{post.viewCount}</span>
              <span className="inline-flex shrink-0 items-center gap-1"><MessageCircle size={13} strokeWidth={1.8} />{post.commentCount}</span>
              <span className="inline-flex shrink-0 items-center gap-1"><ThumbsUp size={13} strokeWidth={1.8} />{post.likeCount}</span>
            </div>
          </div>

          {!blinded && post.thumbnailUrl ? (
            <div className="h-[48px] w-[72px] shrink-0 overflow-hidden rounded-[var(--ui-control-radius)] bg-[var(--ui-surface-muted)] sm:h-[70px] sm:w-[120px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
          ) : null}
        </div>
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
