import { Eye, ArrowLeft, Megaphone } from "lucide-react";
import Link from "next/link";

import { BlindedContent } from "@/components/community/blinded-content";
import { AuthorMenu } from "@/components/community/author-menu";
import { CommentForm } from "@/components/community/comment-form";
import { CommentList } from "@/components/community/comment-list";
import { PostContentViewer } from "@/components/community/editor/post-content-viewer";
import { formatRelativeOrDate } from "@/components/community/format";
import { PostOwnerActions } from "@/components/community/post-owner-actions";
import { PostMobileActions } from "@/components/community/post-mobile-actions";
import { ReactionButtons } from "@/components/community/reaction-buttons";
import { ReportButton } from "@/components/community/report-button";
import { SurfacePanel } from "@/components/ui/surface-panel";
import { setPostNoticeInlineAction } from "@/lib/community/admin-actions";
import type { BoardScope } from "@/lib/community/boards";
import { blindDescription, blindLabel } from "@/lib/community/moderation-labels";
import type { CommunityCommentItem, CommunityPostDetail, ReactionState } from "@/lib/community/types";

export function PostView({
  post,
  comments,
  reaction,
  commentReactions,
  scope,
  teamSlug,
  canManage = false,
  canSetNotice = false,
  viewerId,
  currentGuestKey,
}: {
  post: CommunityPostDetail;
  comments: CommunityCommentItem[];
  reaction: ReactionState;
  commentReactions: Record<string, ReactionState>;
  scope: BoardScope;
  teamSlug?: string;
  canManage?: boolean;
  canSetNotice?: boolean;
  viewerId?: string | null;
  currentGuestKey?: string | null;
}) {
  const boardHref = scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : "/community";
  const blinded = Boolean(post.blindedAt);
  const isGuestOwner = Boolean(post.guestKey && post.guestKey === currentGuestKey);

  return (
    <article className={`${scope === "team" ? "w-full" : "content-reading"} community-post-modal mobile-full-bleed pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:mx-auto md:pb-0`}>
      <PostMobileActions
        postId={post.id}
        scope={scope}
        teamSlug={teamSlug}
        isNotice={post.isNotice}
        canSetNotice={canSetNotice}
        canManage={canManage || isGuestOwner}
        guest={isGuestOwner && !canManage}
      />
      <SurfacePanel variant="section">
        <header className="px-[14px] pb-5 pt-4 md:px-8 md:pb-6 md:pt-8">
          <div className="hidden items-center justify-between gap-4 md:flex">
            <Link href={boardHref} className="hidden items-center gap-1 text-sm font-normal text-[var(--tp)] hover:opacity-70 md:inline-flex"><ArrowLeft size={16} strokeWidth={2} />목록으로</Link>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canSetNotice ? (
                <form action={setPostNoticeInlineAction}>
                  <input type="hidden" name="post_id" value={post.id} />
                  <input type="hidden" name="scope" value={scope} />
                  {teamSlug ? <input type="hidden" name="team_slug" value={teamSlug} /> : null}
                  <input type="hidden" name="is_notice" value={post.isNotice ? "false" : "true"} />
                  <button
                    type="submit"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] text-sm font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)] md:w-auto md:gap-1.5 md:px-3.5"
                    aria-label={post.isNotice ? "공지 해제" : "공지 등록"}
                  >
                    <Megaphone size={15} strokeWidth={1.8} />
                    <span className="hidden md:inline">{post.isNotice ? "공지 해제" : "공지 등록"}</span>
                  </button>
                </form>
              ) : null}
              {canManage ? <PostOwnerActions postId={post.id} scope={scope} teamSlug={teamSlug} /> : isGuestOwner ? <PostOwnerActions postId={post.id} scope={scope} teamSlug={teamSlug} guest /> : null}
            </div>
          </div>
          <h1 className={`text-[16px] leading-[1.45] md:mt-2 md:text-[24px] md:leading-[1.35] ${blinded ? "font-medium text-[var(--ui-muted)]" : "font-bold text-[var(--ui-ink)]"}`}>
            {blinded ? blindLabel(post.blindedSource, "post") : post.title}
          </h1>

          <div className="mt-3 flex items-center">
            <AuthorMenu
              authorId={post.authorId}
              authorName={post.authorName}
              authorImageUrl={post.authorImageUrl}
              authorTier={post.authorTier}
              guestKey={post.guestKey}
              viewerId={viewerId}
              variant="detail"
              evidencePostId={post.id}
              scope={scope}
              teamSlug={teamSlug}
              detailMeta={(
                <span className="inline-flex items-center gap-1.5">
                  <span>{formatRelativeOrDate(post.createdAt)}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1"><Eye size={13} strokeWidth={1.8} />{post.viewCount.toLocaleString("ko-KR")}</span>
                </span>
              )}
            />
          </div>
        </header>

        <div className="mx-[14px] border-t border-[var(--ui-border)] md:mx-8" />

        <div className="community-prose community-post-body min-h-[180px] px-[14px] py-6 text-[14px] leading-[1.75] text-[var(--ui-text)] md:min-h-[220px] md:px-8 md:py-9 md:text-base md:leading-7">
          {blinded ? (
            <BlindedContent
              label={blindLabel(post.blindedSource, "post")}
              description={blindDescription(post.blindedSource)}
              source={post.blindedSource}
            >
              <h2 className="mb-4 text-lg font-bold text-[var(--ui-ink)] md:text-xl">{post.title}</h2>
              <PostContentViewer content={post.content} />
            </BlindedContent>
          ) : (
            <PostContentViewer content={post.content} />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-y border-[var(--ui-border)] px-[14px] py-4 md:gap-4 md:px-8 md:py-6">
          <ReactionButtons
            target="post"
            targetId={post.id}
            postId={post.id}
            scope={scope}
            teamSlug={teamSlug}
            initialState={reaction}
            initialHonorCount={post.likeCount}
            initialDislikeCount={post.dislikeCount}
          />
          <ReportButton target="post" postId={post.id} scope={scope} teamSlug={teamSlug} />
        </div>

        <section aria-label="댓글">
          <div className="flex items-baseline gap-1 px-[14px] py-4 md:px-8 md:py-5">
            <h2 className="text-[17px] font-bold text-[var(--ui-ink)] md:text-lg">댓글</h2>
            <span className="text-sm font-semibold text-[var(--tp)] md:text-base">{post.commentCount}</span>
          </div>
          <div className="hidden px-4 pb-5 md:block md:px-8 md:pb-8">
            <CommentForm postId={post.id} scope={scope} teamSlug={teamSlug} isGuest={!viewerId} />
          </div>
        <CommentList comments={comments} commentReactions={commentReactions} scope={scope} teamSlug={teamSlug} viewerId={viewerId} currentGuestKey={currentGuestKey} />
        </section>
      </SurfacePanel>
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <CommentForm postId={post.id} scope={scope} teamSlug={teamSlug} isGuest={!viewerId} variant="mobileDock" />
      </div>
    </article>
  );
}
