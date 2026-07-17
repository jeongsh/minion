// 인기글(HOT) 판정 단일 소스.
// 기준: 명예 - 싫어요가 스코프별 컷(community_settings.hot_cut, 기본 5) 이상이 되는 순간
// 서버에서 hot_at 스냅샷을 기록한다(lib/data/community.ts promotePostIfHot).
// 등재 후에는 싫어요가 늘어도 유지된다(등락 방지). 클라이언트는 hot_at 유무만 본다.

import type { CommunityPostDetail } from "@/lib/community/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_HOT_WINDOW_MS = 7 * DAY_MS;

/** 인기글 여부(뱃지 노출·인기 탭 필터에 공통 사용). */
export function isHotPost(post: CommunityPostDetail): boolean {
  return post.hotAt !== null;
}

/** 인기 탭 정렬값: 등재 시각(최근 등재가 위). */
export function hotSortValue(post: CommunityPostDetail): number {
  return post.hotAt ? new Date(post.hotAt).getTime() : 0;
}

function hotRecencyBucket(post: CommunityPostDetail, now: number): number {
  const hotAt = hotSortValue(post);
  if (!hotAt) return 0;

  const age = now - hotAt;
  if (age <= DAY_MS) return 2;
  if (age <= RECENT_HOT_WINDOW_MS) return 1;
  return 0;
}

export function hotHypeScore(post: CommunityPostDetail): number {
  const netLikes = Math.max(0, post.likeCount - post.dislikeCount);
  return netLikes * 10 + post.commentCount * 4 + Math.log10(post.viewCount + 1);
}

export function compareHotPostsByRecentHype(
  a: CommunityPostDetail,
  b: CommunityPostDetail,
  now = Date.now(),
): number {
  return (
    hotRecencyBucket(b, now) - hotRecencyBucket(a, now) ||
    hotHypeScore(b) - hotHypeScore(a) ||
    hotSortValue(b) - hotSortValue(a) ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
