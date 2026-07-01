// 인기글(HOT) 판정 단일 소스.
// 기준: 명예(추천) + 댓글 합산 점수. 필터 칩과 목록/갤러리 뱃지가 모두 이 값을 참조한다.

import type { CommunityPostDetail } from "@/lib/community/types";

/** 인기글로 인정하는 최소 합산 점수(명예 + 댓글). 이 값 이상이면 HOT. */
export const HOT_SCORE_THRESHOLD = 10;

/** 인기 점수 = 명예 + 댓글. 정렬 기준으로도 사용. */
export function hotScore(post: CommunityPostDetail): number {
  return post.likeCount + post.commentCount;
}

/** 기준 충족 여부(뱃지 노출·인기 탭 필터에 공통 사용). */
export function isHotPost(post: CommunityPostDetail): boolean {
  return hotScore(post) >= HOT_SCORE_THRESHOLD;
}
