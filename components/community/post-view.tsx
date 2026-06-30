import { CommentForm } from "@/components/community/comment-form";
import { CommentList } from "@/components/community/comment-list";
import { PostContentViewer } from "@/components/community/editor/post-content-viewer";
import { formatRelativeOrDate } from "@/components/community/format";
import { HonorButton } from "@/components/community/honor-button";
import { ReportButton } from "@/components/community/report-button";
import type { BoardScope } from "@/lib/community/boards";
import type { CommunityCommentItem, CommunityPostDetail } from "@/lib/community/types";

// 글 상세: 본문 + 명예/리폿 + 댓글 목록 + 댓글 폼.
export function PostView({
  post,
  comments,
  honored,
  scope,
  teamSlug,
}: {
  post: CommunityPostDetail;
  comments: CommunityCommentItem[];
  honored: boolean;
  scope: BoardScope;
  teamSlug?: string;
}) {
  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold md:text-3xl">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>{formatRelativeOrDate(post.createdAt)}</span>
          <span>조회 {post.viewCount}</span>
          <span>명예 {post.likeCount}</span>
          <span>댓글 {post.commentCount}</span>
        </div>
      </header>

      <PostContentViewer content={post.content} />

      <div className="flex flex-wrap items-center gap-4 border-y border-border py-4">
        <HonorButton
          postId={post.id}
          scope={scope}
          teamSlug={teamSlug}
          initialHonored={honored}
          initialCount={post.likeCount}
        />
        <ReportButton target="post" postId={post.id} scope={scope} teamSlug={teamSlug} />
      </div>

      <section className="flex flex-col gap-4" aria-label="댓글">
        <h2 className="text-lg font-semibold">댓글 {post.commentCount}</h2>
        <CommentList comments={comments} scope={scope} teamSlug={teamSlug} />
        <CommentForm postId={post.id} scope={scope} teamSlug={teamSlug} />
      </section>
    </article>
  );
}
