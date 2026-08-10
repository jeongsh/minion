import { Eye, ArrowLeft, Megaphone } from "lucide-react";
import Link from "next/link";

import { BlindedContent } from "@/components/community/blinded-content";
import { CommentForm } from "@/components/community/comment-form";
import { CommentList } from "@/components/community/comment-list";
import { PostContentViewer } from "@/components/community/editor/post-content-viewer";
import { formatRelativeOrDate } from "@/components/community/format";
import { PostOwnerActions } from "@/components/community/post-owner-actions";
import { ReactionButtons } from "@/components/community/reaction-buttons";
import { ReportButton } from "@/components/community/report-button";
import { SurfacePanel } from "@/components/ui/surface-panel";
import { RankAvatar } from "@/components/rank/rank-avatar";
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
}: {
  post: CommunityPostDetail;
  comments: CommunityCommentItem[];
  reaction: ReactionState;
  commentReactions: Record<string, ReactionState>;
  scope: BoardScope;
  teamSlug?: string;
  canManage?: boolean;
  canSetNotice?: boolean;
}) {
  const boardHref = scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : "/community";
  const initial = (post.authorName ?? "글").trim().charAt(0) || "글";
  const blinded = Boolean(post.blindedAt);

  return (
    <article className={`${scope === "team" ? "w-full" : "content-reading"} mobile-full-bleed md:mx-auto`}>
      <SurfacePanel variant="section">
        <header className="px-4 pb-4 pt-5 sm:px-8 sm:pb-6 sm:pt-8">
          <div className="flex items-center justify-between gap-4">
            <Link href={boardHref} className="inline-flex items-center text-sm font-normal text-[var(--tp)] hover:opacity-70 gap-1"><ArrowLeft size={16} strokeWidth={2} />목록으로</Link>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canSetNotice ? (
                <form action={setPostNoticeInlineAction}>
                  <input type="hidden" name="post_id" value={post.id} />
                  <input type="hidden" name="scope" value={scope} />
                  {teamSlug ? <input type="hidden" name="team_slug" value={teamSlug} /> : null}
                  <input type="hidden" name="is_notice" value={post.isNotice ? "false" : "true"} />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-1.5 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] px-3.5 text-sm font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]"
                  >
                    <Megaphone size={15} strokeWidth={1.8} />
                    {post.isNotice ? "공지 해제" : "공지 등록"}
                  </button>
                </form>
              ) : null}
              {canManage ? <PostOwnerActions postId={post.id} scope={scope} teamSlug={teamSlug} /> : null}
            </div>
          </div>
          <h1 className={`mt-2 text-[20px] leading-[1.35] sm:text-[24px] ${blinded ? "font-medium text-[var(--ui-muted)]" : "font-bold text-[var(--ui-ink)]"}`}>
            {blinded ? blindLabel(post.blindedSource, "post") : post.title}
          </h1>

          <div className="mt-2 flex items-center gap-3">
            <RankAvatar
              tier={post.authorTier}
              src={post.authorImageUrl}
              alt={post.authorName ?? "작성자"}
              fallback={initial}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ui-ink)]">{post.authorName ?? "작성자"}</p>
              <div className="mt-0.5 flex items-center gap-2 text-[13px] text-[var(--ui-muted)]">
                <span>{formatRelativeOrDate(post.createdAt)}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1"><Eye size={13} strokeWidth={1.8} />{post.viewCount.toLocaleString("ko-KR")}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-4 border-t border-[var(--ui-border)] sm:mx-8" />

        <div className="community-prose min-h-[160px] px-4 py-6 text-base leading-7 text-[var(--ui-text)] sm:min-h-[220px] sm:px-8 sm:py-9">
          {blinded ? (
            <BlindedContent
              label={blindLabel(post.blindedSource, "post")}
              description={blindDescription(post.blindedSource)}
              source={post.blindedSource}
            >
              <h2 className="mb-4 text-lg font-bold text-[var(--ui-ink)] sm:text-xl">{post.title}</h2>
              <PostContentViewer content={post.content} />
            </BlindedContent>
          ) : (
            <PostContentViewer content={post.content} />
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-y border-[var(--ui-border)] px-4 py-5 sm:px-8 sm:py-6">
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
          <div className="flex items-baseline gap-1 px-4 py-4 sm:px-8 sm:py-5">
            <h2 className="text-lg font-bold text-[var(--ui-ink)]">댓글</h2>
            <span className="text-sm font-semibold text-[var(--tp)] sm:text-base">{post.commentCount}</span>
          </div>
          <div className="px-4 pb-5 sm:px-8 sm:pb-8">
            <CommentForm postId={post.id} scope={scope} teamSlug={teamSlug} />
          </div>
          <CommentList comments={comments} commentReactions={commentReactions} scope={scope} teamSlug={teamSlug} />
        </section>
      </SurfacePanel>
    </article>
  );
}
