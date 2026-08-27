export const BEST_COMMENT_LIMIT = 3;
export const BEST_COMMENT_MIN_LIKES = 5;
export const BEST_COMMENT_MIN_NET_SCORE = 3;

type BestCommentCandidate = {
  id: string;
  parentId: string | null;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
  blindedAt: string | null;
  deletedAt: string | null;
};

/** 베스트 댓글은 정상 노출 중인 최상위 댓글 가운데 순추천이 높은 최대 3개다. */
export function selectBestComments<T extends BestCommentCandidate>(comments: readonly T[]): T[] {
  return [...comments]
    .filter((comment) => (
      !comment.parentId
      && !comment.blindedAt
      && !comment.deletedAt
      && comment.likeCount >= BEST_COMMENT_MIN_LIKES
      && comment.likeCount - comment.dislikeCount >= BEST_COMMENT_MIN_NET_SCORE
    ))
    .sort((a, b) => (
      (b.likeCount - b.dislikeCount) - (a.likeCount - a.dislikeCount)
      || b.likeCount - a.likeCount
      || a.createdAt.localeCompare(b.createdAt)
    ))
    .slice(0, BEST_COMMENT_LIMIT);
}
