import { formatRelativeOrDate } from "@/components/community/format";
import { ReportButton } from "@/components/community/report-button";
import type { BoardScope } from "@/lib/community/boards";
import type { CommunityCommentItem } from "@/lib/community/types";

// 댓글 목록 — 시안 2a. 아바타 + 작성자 줄 + 본문 + 메타.
export function CommentList({
  comments,
  scope,
  teamSlug,
}: {
  comments: CommunityCommentItem[];
  scope: BoardScope;
  teamSlug?: string;
}) {
  if (comments.length === 0) {
    return <p className="py-2 text-sm text-muted">아직 댓글이 없습니다.</p>;
  }

  return (
    <ul className="flex flex-col gap-5">
      {comments.map((comment) => (
        <li key={comment.id} className="flex gap-3">
          {/* TODO: 작성자 표시명/아바타 join 시 교체 */}
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-muted text-[10px] font-bold text-muted">
            글
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[13px] font-bold text-foreground">작성자</span>
              <span className="text-[11px] text-muted">{formatRelativeOrDate(comment.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{comment.content}</p>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
              <span className="font-semibold">명예 {comment.likeCount}</span>
              <ReportButton
                target="comment"
                commentId={comment.id}
                postId={comment.postId}
                scope={scope}
                teamSlug={teamSlug}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
