import Link from "next/link";

import { CommentForm } from "@/components/community/comment-form";
import { CommentList } from "@/components/community/comment-list";
import { PostContentViewer } from "@/components/community/editor/post-content-viewer";
import { formatRelativeOrDate } from "@/components/community/format";
import { HonorButton } from "@/components/community/honor-button";
import { ReportButton } from "@/components/community/report-button";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import type { CommunityCommentItem, CommunityPostDetail } from "@/lib/community/types";

// 글 상세 — 시안 2a. 제목 블록 + 작성자 줄 + 본문 + 중앙 명예 + 댓글 위계.
// 색상은 토큰만 사용 → 팀 프라이머리(--accent)를 그대로 따른다.
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
  const boardHref =
    scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : `/community`;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="px-6 pt-7 sm:px-9">
        <div className="mb-3.5 flex items-center gap-2 text-xs text-muted">
          <Link href={boardHref} className="font-semibold text-accent hover:underline">
            커뮤니티
          </Link>
          <span aria-hidden>›</span>
          <span className="rounded-md bg-surface-muted px-2 py-1 font-semibold text-muted">
            {boardLabel(scope, post.boardType)}
          </span>
        </div>

        <h1 className="text-2xl font-extrabold leading-snug tracking-tight text-foreground md:text-[28px]">
          {post.title}
        </h1>

        <div className="mt-5 flex items-center gap-3 border-b border-border pb-5">
          {/* TODO: 작성자 표시명/아바타 join 시 이 영역을 실제 데이터로 교체 */}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-[11px] font-bold text-muted">
            글
          </span>
          <div>
            <div className="text-sm font-bold text-foreground">작성자</div>
            <div className="mt-1 text-xs text-muted">
              {formatRelativeOrDate(post.createdAt)} · 조회 {post.viewCount}
            </div>
          </div>
          <div className="ml-auto">
            <ReportButton target="post" postId={post.id} scope={scope} teamSlug={teamSlug} />
          </div>
        </div>
      </header>

      <div className="px-6 pb-2 pt-6 sm:px-9">
        <PostContentViewer content={post.content} />
      </div>

      <div className="flex flex-col items-center gap-2 border-b border-border px-6 py-7">
        <HonorButton
          postId={post.id}
          scope={scope}
          teamSlug={teamSlug}
          initialHonored={honored}
          initialCount={post.likeCount}
        />
        <p className="text-xs text-muted">이 글이 좋았다면 명예를 눌러주세요</p>
      </div>

      <section className="px-6 py-7 sm:px-9" aria-label="댓글">
        <h2 className="mb-4 text-[15px] font-extrabold text-foreground">
          댓글 <span className="text-accent">{post.commentCount}</span>
        </h2>
        <CommentList comments={comments} scope={scope} teamSlug={teamSlug} />
        <div className="mt-5">
          <CommentForm postId={post.id} scope={scope} teamSlug={teamSlug} />
        </div>
      </section>
    </article>
  );
}
