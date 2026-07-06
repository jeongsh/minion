import { Eye, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { CommentForm } from "@/components/community/comment-form";
import { CommentList } from "@/components/community/comment-list";
import { PostContentViewer } from "@/components/community/editor/post-content-viewer";
import { formatRelativeOrDate } from "@/components/community/format";
import { PostOwnerActions } from "@/components/community/post-owner-actions";
import { ReactionButtons } from "@/components/community/reaction-buttons";
import { ReportButton } from "@/components/community/report-button";
import { SurfacePanel } from "@/components/ui/surface-panel";
import type { BoardScope } from "@/lib/community/boards";
import type { CommunityCommentItem, CommunityPostDetail, ReactionState } from "@/lib/community/types";

export function PostView({
  post,
  comments,
  reaction,
  commentReactions,
  scope,
  teamSlug,
  canManage = false,
}: {
  post: CommunityPostDetail;
  comments: CommunityCommentItem[];
  reaction: ReactionState;
  commentReactions: Record<string, ReactionState>;
  scope: BoardScope;
  teamSlug?: string;
  canManage?: boolean;
}) {
  const boardHref = scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : "/community";
  const initial = (post.authorName ?? "글").trim().charAt(0) || "글";

  return (
    <article className={scope === "team" ? "w-full" : "mx-auto w-full max-w-[1120px]"}>
      <SurfacePanel>
        <header className="px-5 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
          <div className="flex items-center justify-between gap-4">
            <Link href={boardHref} className="inline-flex items-center text-sm font-normal text-[var(--tp)] hover:opacity-70 gap-1"><ArrowLeft size={16} strokeWidth={2} />목록으로</Link>
            {canManage ? <PostOwnerActions postId={post.id} scope={scope} teamSlug={teamSlug} /> : null}
          </div>
          <h1 className="mt-1 text-2xl font-semibold leading-[1.4] tracking-[-0.02em] text-[var(--ui-ink)] sm:text-[26px]">
            {post.title}
          </h1>

          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ui-surface-muted)] text-sm font-bold text-[var(--ui-muted)]">
              {post.authorImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.authorImageUrl} alt="" className="h-full w-full object-cover" />
              ) : initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--ui-ink)]">{post.authorName ?? "작성자"}</p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--ui-muted)]">
                <span>{formatRelativeOrDate(post.createdAt)}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1"><Eye size={13} strokeWidth={1.8} />{post.viewCount.toLocaleString("ko-KR")}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-5 border-t border-[var(--ui-border)] sm:mx-8" />

        <div className="community-prose min-h-[200px] px-5 py-8 text-m leading-[1.8] text-[var(--ui-text)] sm:min-h-[240px] sm:px-8 sm:py-10">
          <PostContentViewer content={post.content} />
        </div>

        <div className="flex items-center justify-between gap-4 px-5 py-6 sm:px-8">
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
          <div className="flex items-baseline gap-1 px-5 py-5 sm:px-8">
            <h2 className="text-base font-bold text-[var(--ui-ink)]">댓글</h2>
            <span className="text-m font-semibold text-[var(--tp)]">{post.commentCount}</span>
          </div>
          <div className="px-5 pb-6 sm:px-8 sm:pb-8">
            <CommentForm postId={post.id} scope={scope} teamSlug={teamSlug} />
          </div>
          <CommentList comments={comments} commentReactions={commentReactions} scope={scope} teamSlug={teamSlug} />
        </section>
      </SurfacePanel>
    </article>
  );
}
