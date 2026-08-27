// 인기글(HOT) 판정 단일 소스.
// 기준: 명예 - 싫어요가 스코프별 컷(community_settings.hot_cut, 기본 5) 이상이 되는 순간
// 서버에서 hot_at 스냅샷을 기록한다(lib/data/community.ts promotePostIfHot).
// 등재 후에는 싫어요가 늘어도 유지된다(등락 방지). 클라이언트는 hot_at 유무만 본다.

import type { CommunityPostDetail } from "@/lib/community/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_HOT_WINDOW_MS = 7 * DAY_MS;

/** 메인·팬 홈 게시판 영역에 실제로 노출하는 글 수. */
export const COMMUNITY_HOME_POST_LIMIT = 6;

/** 홈 인기글 정렬에 사용할 후보 수. */
export const COMMUNITY_HOME_HOT_CANDIDATE_LIMIT = 30;

/** 차단·블라인드·인기글 중복을 제외하고도 최신글 보충분이 남도록 넉넉히 조회한다. */
export const COMMUNITY_HOME_LATEST_CANDIDATE_LIMIT = 20;

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

/**
 * 메인·팬 홈 게시판 구성.
 * 인기글을 먼저 최근 화력순으로 배치하고, 목표 개수에 못 미치면 최신글로 채운다.
 * 최신 목록에 인기글이 다시 포함돼도 id 기준으로 한 번만 노출한다.
 */
export function selectCommunityHomePosts(
  popularPosts: CommunityPostDetail[],
  latestPosts: CommunityPostDetail[],
  limit = COMMUNITY_HOME_POST_LIMIT,
): CommunityPostDetail[] {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : COMMUNITY_HOME_POST_LIMIT;
  if (safeLimit === 0) return [];

  const visible = (post: CommunityPostDetail) => !post.blindedAt && !post.isNotice;
  const popular = [...popularPosts]
    .filter((post) => visible(post) && isHotPost(post))
    .sort(compareHotPostsByRecentHype);
  const latest = latestPosts.filter(visible);
  const selected = new Map<string, CommunityPostDetail>();

  for (const post of [...popular, ...latest]) {
    if (!selected.has(post.id)) selected.set(post.id, post);
    if (selected.size >= safeLimit) break;
  }

  return [...selected.values()];
}

/**
 * 홈 목록에 최신글 보충분이 실제로 포함됐는지에 따라 사용자에게 보일 제목을 정한다.
 * 빈 목록도 인기글로 오인하지 않도록 최신글로 표시한다.
 */
export function communityHomeSectionTitle(
  posts: CommunityPostDetail[],
): "인기글" | "최신글" {
  return posts.length > 0 && posts.every(isHotPost) ? "인기글" : "최신글";
}
