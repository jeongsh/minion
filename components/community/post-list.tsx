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
          className="pointer-events-none relative z-[1] grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 px-2.5 py-2 min-[390px]:min-h-[65px] min-[390px]:gap-3 min-[390px]:px-3 sm:min-h-[72px] sm:gap-4 sm:px-2 sm:py-3"
        >
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              {isNoticeRow ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--ui-ink)] px-1.5 py-0.5 text-[10.5px] font-medium leading-none text-[var(--ui-surface)] min-[390px]:gap-1 min-[390px]:text-[12px] sm:px-2">
                  <Megaphone size={9} strokeWidth={2} className="sm:h-[11px] sm:w-[11px]" />공지
                </span>
              ) : (
                <span className="shrink-0 text-[10.5px] font-medium text-[var(--tp)] min-[390px]:text-[12px] sm:text-[13px]">{boardLabel(scope, post.boardType)}</span>
              )}
              {!blinded && isHotPost(post) ? (
                <span className="shrink-0 rounded-full border border-[var(--tp)] px-1 py-0.5 text-[10.5px] font-medium leading-none text-[var(--tp)] min-[390px]:px-1.5 min-[390px]:text-[12px] sm:text-[13px]">인기</span>
              ) : null}
              {blinded ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[14px] font-medium text-[var(--ui-muted)] sm:text-base">
                  {cleansingBotBlinded ? (
                    <Image
                      src={cleansingBotWarning}
                      alt=""
                      width={24}
                      height={24}
                      className="-my-0.5 h-[18px] w-[18px] shrink-0 object-contain sm:-my-1 sm:h-6 sm:w-6"
                      aria-hidden
                    />
                  ) : (
                    <EyeOff size={12} strokeWidth={1.8} className="shrink-0 sm:h-[14px] sm:w-[14px]" />
                  )}
                  {blindLabel(post.blindedSource, "post")}
                </span>
              ) : (
                <span className="truncate text-[14px] font-medium text-[var(--ui-ink)] sm:text-base">{post.title}</span>
              )}
            </div>

            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[10.5px] font-normal text-[var(--ui-muted)] min-[390px]:gap-2 min-[390px]:text-[12px] sm:gap-2.5 sm:text-[13px]">
              <span className="pointer-events-auto relative z-10 inline-flex min-w-0">
                <AuthorMenu authorId={post.authorId} authorName={post.authorName} authorImageUrl={post.authorImageUrl} authorTier={post.authorTier} guestKey={post.guestKey} viewerId={viewerId} variant="feed" evidencePostId={post.id} scope={scope} teamSlug={teamSlug} />
              </span>
              <span className="shrink-0">{formatRelativeOrDate(post.createdAt)}</span>
              <span className="hidden shrink-0 items-center gap-1 sm:inline-flex"><Eye size={13} strokeWidth={1.8} />{post.viewCount}</span>
              <span className="inline-flex shrink-0 items-center gap-0.5 min-[390px]:gap-1"><MessageCircle size={11} strokeWidth={1.8} className="sm:h-[13px] sm:w-[13px]" />{post.commentCount}</span>
              <span className="inline-flex shrink-0 items-center gap-0.5 min-[390px]:gap-1"><ThumbsUp size={11} strokeWidth={1.8} className="sm:h-[13px] sm:w-[13px]" />{post.likeCount}</span>
            </div>
          </div>

          {!blinded && post.thumbnailUrl ? (
            <div className="h-[51px] w-[68px] shrink-0 overflow-hidden rounded-md bg-[var(--ui-surface-muted)] min-[390px]:h-[57px] min-[390px]:w-[76px] min-[390px]:rounded-lg sm:h-[70px] sm:w-[120px] sm:rounded-[var(--ui-control-radius)]">
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
