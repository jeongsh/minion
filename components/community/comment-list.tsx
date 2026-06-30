import { formatRelativeOrDate } from "@/components/community/format";
import { ReportButton } from "@/components/community/report-button";
import type { BoardScope } from "@/lib/community/boards";
import type { CommunityCommentItem } from "@/lib/community/types";

// 댓글 목록. 각 댓글에 리폿 버튼(댓글 대상).
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
    return <p className="text-sm text-muted">아직 댓글이 없습니다.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {comments.map((comment) => (
        <li key={comment.id} className="flex flex-col gap-1 py-3">
          <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>{formatRelativeOrDate(comment.createdAt)}</span>
            <ReportButton
              target="comment"
              commentId={comment.id}
              postId={comment.postId}
              scope={scope}
              teamSlug={teamSlug}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
