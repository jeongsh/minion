import { formatRelativeOrDate } from "@/components/community/format";
import { ReactionButtons } from "@/components/community/reaction-buttons";
import { ReportButton } from "@/components/community/report-button";
import type { BoardScope } from "@/lib/community/boards";
import type { CommunityCommentItem, ReactionState } from "@/lib/community/types";

// 댓글 목록 — 시안 2a. 정확값 동기화 버전.
export function CommentList({
  comments,
  commentReactions,
  scope,
  teamSlug,
}: {
  comments: CommunityCommentItem[];
  commentReactions: Record<string, ReactionState>;
  scope: BoardScope;
  teamSlug?: string;
}) {
  if (comments.length === 0) {
    return <p className="py-2 text-[14px] text-[#8a93a6]">아직 댓글이 없습니다.</p>;
  }

  return (
    <ul className="flex flex-col gap-[18px]">
      {comments.map((comment) => (
        <li key={comment.id} className="flex gap-[11px]">
          {/* TODO: 작성자 표시명/아바타 join 시 교체 */}
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#e9edf4] text-[10px] font-bold text-[#6b7488]">
            글
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-[5px] flex items-center gap-[7px]">
              <span className="text-[13px] font-bold text-[#28324a]">작성자</span>
              <span className="text-[11.5px] text-[#a4acbb]">{formatRelativeOrDate(comment.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-[#3a4356]">{comment.content}</p>
            <div className="mt-[7px] flex flex-wrap items-center gap-2 text-[12px] font-semibold text-[#9aa3b5]">
              <ReactionButtons
                target="comment"
                targetId={comment.id}
                postId={comment.postId}
                scope={scope}
                teamSlug={teamSlug}
                initialState={commentReactions[comment.id] ?? null}
                initialHonorCount={comment.likeCount}
                initialDislikeCount={comment.dislikeCount}
                size="sm"
              />
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
