// 게시판 트랙 데이터 계층(읽기/쓰기).
// lib/data/lck.ts 의 읽기 함수와 별개로 이 트랙 전용 read/write 를 둔다.
// 쓰기는 항상 author_id/user_id 를 getCurrentUser().id 로 채운다(서버 액션에서 사용).

import { cache } from "react";
import { canQuerySupabase, createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractPlainText, extractThumbnail } from "@/lib/community/extract-thumbnail";
import { AI_MODERATOR_NAME } from "@/lib/community/moderation-labels";
import type { BoardScope } from "@/lib/community/boards";
import { DEFAULT_TIER, type Tier } from "@/lib/rank/config";
import { getPublicRankProfiles } from "@/lib/rank/public-profile";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBlockedCommunityUserIds } from "@/lib/data/community-users";
import type {
  BlindSource,
  CommunityAuthorCommentItem,
  CommunityCommentItem,
  CommunityPostDetail,
  ReactionKind,
  ReactionState,
  ReactionTarget,
} from "@/lib/community/types";

type PostRow = {
  id: string;
  board_type: string;
  site_scope: BoardScope;
  team_id: string | null;
  title: string;
  content: string;
  author_id: string | null;
  like_count: number;
  dislike_count: number | null;
  comment_count: number;
  view_count: number;
  report_count: number | null;
  created_at: string;
  hot_at: string | null;
  is_notice: boolean | null;
  blinded_at: string | null;
  blinded_source: BlindSource | null;
  deleted_at: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string | null;
  content: string;
  like_count: number;
  dislike_count: number | null;
  created_at: string;
  blinded_at: string | null;
  blinded_source: BlindSource | null;
  deleted_at: string | null;
};

const POST_COLUMNS =
  "id, board_type, site_scope, team_id, title, content, author_id, like_count, dislike_count, comment_count, view_count, report_count, created_at, hot_at, is_notice, blinded_at, blinded_source, deleted_at";

const COMMENT_COLUMNS =
  "id, post_id, parent_id, author_id, content, like_count, dislike_count, created_at, blinded_at, blinded_source, deleted_at";

/** 목록 조회 상한(전체 로드 방지 가드). 피드는 클라이언트에서 검색/페이징한다. */
const POST_LIST_LIMIT = 500;

async function blockedAuthorIdsForCurrentUser(): Promise<Set<string>> {
  const user = await getCurrentUser();
  return user ? getBlockedCommunityUserIds(user.id) : new Set();
}

function mapPost(
  row: PostRow,
  authorName: string | null = null,
  authorImageUrl: string | null = null,
  authorTier: Tier = DEFAULT_TIER,
): CommunityPostDetail {
  return {
    id: row.id,
    boardType: row.board_type,
    siteScope: row.site_scope,
    teamId: row.team_id,
    title: row.title,
    content: row.content,
    authorId: row.author_id,
    authorName,
    authorImageUrl,
    authorTier,
    likeCount: row.like_count,
    dislikeCount: row.dislike_count ?? 0,
    commentCount: row.comment_count,
    viewCount: row.view_count,
    reportCount: row.report_count ?? 0,
    createdAt: row.created_at,
    hotAt: row.hot_at,
    isNotice: row.is_notice ?? false,
    blindedAt: row.blinded_at,
    blindedSource: row.blinded_source,
    deletedAt: row.deleted_at,
    thumbnailUrl: extractThumbnail(row.content),
    excerpt: extractPlainText(row.content),
  };
}

async function mapPostsWithAuthors(rows: PostRow[]): Promise<CommunityPostDetail[]> {
  const authorIds = [...new Set(rows.flatMap((row) => (row.author_id ? [row.author_id] : [])))];
  if (authorIds.length === 0) return rows.map((row) => mapPost(row));

  const profiles = await getPublicRankProfiles(authorIds);
  return rows.map((row) => {
    const profile = row.author_id ? profiles.get(row.author_id) : undefined;
    return mapPost(row, profile?.nickname ?? null, profile?.profileImageUrl ?? null, profile?.tier);
  });
}

function mapComment(
  row: CommentRow,
  authorName: string | null = null,
  authorImageUrl: string | null = null,
  authorTier: Tier = DEFAULT_TIER,
): CommunityCommentItem {
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    authorId: row.author_id,
    authorName,
    authorImageUrl,
    authorTier,
    // 삭제된 댓글 본문은 클라이언트로 내려보내지 않는다(답글 유지를 위한 자리표시만 필요).
    content: row.deleted_at ? "" : row.content,
    likeCount: row.like_count,
    dislikeCount: row.dislike_count ?? 0,
    createdAt: row.created_at,
    blindedAt: row.blinded_at,
    blindedSource: row.blinded_source,
    deletedAt: row.deleted_at,
  };
}

async function mapCommentsWithAuthors(rows: CommentRow[]): Promise<CommunityCommentItem[]> {
  const authorIds = [...new Set(rows.flatMap((row) => (row.author_id ? [row.author_id] : [])))];
  if (authorIds.length === 0) return rows.map((row) => mapComment(row));

  const profiles = await getPublicRankProfiles(authorIds);
  return rows.map((row) => {
    const profile = row.author_id ? profiles.get(row.author_id) : undefined;
    return mapComment(row, profile?.nickname ?? null, profile?.profileImageUrl ?? null, profile?.tier);
  });
}

/**
 * 커뮤니티 글 목록 조회(단일 피드).
 * boardType 미지정 시 전체 말머리 글을 한 번에 조회(전체 탭).
 * teamId 는 team scope 에서만 사용.
 */
export const getBoardPosts = cache(async function getBoardPosts(params: {
  scope: BoardScope;
  boardType?: string | null;
  teamId?: string | null;
}): Promise<CommunityPostDetail[]> {
  if (!canQuerySupabase()) return [];

  let query = createSupabaseServerClient()
    .from("community_posts")
    .select(POST_COLUMNS)
    .eq("site_scope", params.scope)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(POST_LIST_LIMIT);

  if (params.boardType) {
    query = query.eq("board_type", params.boardType);
  }

  if (params.scope === "team" && params.teamId) {
    query = query.eq("team_id", params.teamId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const blockedIds = await blockedAuthorIdsForCurrentUser();
  const rows = (data as PostRow[]).filter((row) => !row.author_id || !blockedIds.has(row.author_id));
  return mapPostsWithAuthors(rows);
});

/** 단건 조회(조회수 증가 X — 순수 조회). */
export const getPostById = cache(async function getPostById(
  postId: string,
): Promise<CommunityPostDetail | null> {
  if (!canQuerySupabase()) return null;

  const { data, error } = await createSupabaseServerClient()
    .from("community_posts")
    .select(POST_COLUMNS)
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const blockedIds = await blockedAuthorIdsForCurrentUser();
  if ((data as PostRow).author_id && blockedIds.has((data as PostRow).author_id!)) return null;
  return (await mapPostsWithAuthors([data as PostRow]))[0] ?? null;
});

/** 단건 조회 + 조회수 증가. 상세 페이지 진입 시 사용. */
export async function getPostByIdAndIncrementView(
  postId: string,
): Promise<CommunityPostDetail | null> {
  const post = await getPostById(postId);
  if (!post) return null;

  if (canQuerySupabase()) {
    // 카운트 갱신은 작성자 외 사용자도 수행하므로 RLS 우회(service-role).
    // 조회수는 best-effort: 서비스 롤 키 미설정 등으로 실패해도 렌더는 막지 않는다.
    try {
      const { data } = await createSupabaseAdminClient().rpc(
        "increment_community_post_view_count",
        { p_post_id: postId },
      );
      if (typeof data === "number") {
        return { ...post, viewCount: data };
      }
    } catch {
      return post;
    }
  } else {
    return post;
  }

  return { ...post, viewCount: post.viewCount + 1 };
}

/** 댓글 목록 조회(오래된 순). */
export const getPostComments = cache(async function getPostComments(
  postId: string,
): Promise<CommunityCommentItem[]> {
  if (!canQuerySupabase()) return [];

  const { data, error } = await createSupabaseServerClient()
    .from("community_comments")
    .select(COMMENT_COLUMNS)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  // 삭제된 댓글은 답글이 남아 있는 경우에만 자리표시용으로 유지하고, 아니면 목록에서 제외한다.
  const blockedIds = await blockedAuthorIdsForCurrentUser();
  const rows = (data as CommentRow[]).filter(
    (row) => !row.author_id || !blockedIds.has(row.author_id),
  );
  const parentIdsWithReplies = new Set(
    rows.flatMap((row) => (row.parent_id && !row.deleted_at ? [row.parent_id] : [])),
  );
  const visible = rows.filter(
    (row) => !row.deleted_at || (!row.parent_id && parentIdsWithReplies.has(row.id)),
  );
  return mapCommentsWithAuthors(visible);
});

/** Public activity list for a community author. Deleted content is never exposed. */
export async function getPostsByAuthor(authorId: string): Promise<CommunityPostDetail[]> {
  if (!canQuerySupabase()) return [];
  const blockedIds = await blockedAuthorIdsForCurrentUser();
  if (blockedIds.has(authorId)) return [];

  const { data, error } = await createSupabaseServerClient()
    .from("community_posts")
    .select(POST_COLUMNS)
    .eq("author_id", authorId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return mapPostsWithAuthors((data ?? []) as PostRow[]);
}

/** Public comment activity with enough parent-post metadata to build links. */
export async function getCommentsByAuthor(
  authorId: string,
): Promise<CommunityAuthorCommentItem[]> {
  if (!canQuerySupabase()) return [];
  const blockedIds = await blockedAuthorIdsForCurrentUser();
  if (blockedIds.has(authorId)) return [];

  const { data, error } = await createSupabaseServerClient()
    .from("community_comments")
    .select(COMMENT_COLUMNS)
    .eq("author_id", authorId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const comments = (data ?? []) as CommentRow[];
  if (comments.length === 0) return [];

  const postIds = [...new Set(comments.map((comment) => comment.post_id))];
  const { data: postData, error: postError } = await createSupabaseServerClient()
    .from("community_posts")
    .select("id, title, site_scope, team_id, deleted_at")
    .in("id", postIds)
    .is("deleted_at", null);
  if (postError) throw postError;
  const posts = new Map(
    ((postData ?? []) as {
      id: string;
      title: string;
      site_scope: BoardScope;
      team_id: string | null;
    }[]).map((post) => [post.id, post]),
  );
  const mapped = await mapCommentsWithAuthors(comments);
  return mapped.flatMap((comment) => {
    const post = posts.get(comment.postId);
    return post
      ? [{
          ...comment,
          postTitle: post.title,
          postSiteScope: post.site_scope,
          postTeamId: post.team_id,
        }]
      : [];
  });
}

/** 글 생성. author_id 는 호출부(서버 액션)에서 getCurrentUser().id 로 전달. */
export async function createPost(params: {
  scope: BoardScope;
  boardType: string;
  teamId?: string | null;
  title: string;
  content: string;
  authorId: string;
  isNotice?: boolean;
}): Promise<{ id: string }> {
  // 쓰기는 인증 컨텍스트(RLS)가 없는 anon 대신 service-role 로 수행한다.
  // 인가는 호출부(서버 액션)의 getCurrentUser + 본인확인으로 이미 보장된다.
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      board_type: params.boardType,
      site_scope: params.scope,
      team_id: params.scope === "team" ? params.teamId ?? null : null,
      title: params.title,
      content: params.content,
      author_id: params.authorId,
      is_notice: params.isNotice ?? false,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: (data as { id: string }).id };
}

export async function updatePost(params: {
  postId: string;
  boardType: string;
  title: string;
  content: string;
}): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("community_posts")
    .update({ board_type: params.boardType, title: params.title, content: params.content })
    .eq("id", params.postId);
  if (error) throw error;
}

/**
 * 글 삭제(소프트). 행을 지우지 않고 deleted_at 만 기록한다.
 * 목록/상세에서는 제외되고, 분쟁 대응을 위해 어드민에서 원문 확인·복구가 가능하다.
 */
export async function deletePost(postId: string): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("community_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw error;
}

/** 댓글 생성. comment_count 증가도 함께 처리. */
export async function createComment(params: {
  postId: string;
  content: string;
  authorId: string;
  parentId?: string | null;
}): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("community_comments")
    .insert({
      post_id: params.postId,
      parent_id: params.parentId ?? null,
      content: params.content,
      author_id: params.authorId,
    })
    .select("id")
    .single();

  if (error) throw error;

  const post = await getPostById(params.postId);
  if (post) {
    await supabase
      .from("community_posts")
      .update({ comment_count: post.commentCount + 1 })
      .eq("id", params.postId);
  }

  return { id: (data as { id: string }).id };
}

// 리액션(명예/싫어요) 저장소 메타.
// 글/댓글 × 명예/싫어요 조합별로 행 테이블·FK·집계 카운트 위치를 매핑한다.
type ReactionMeta = {
  table: string;
  fk: "post_id" | "comment_id";
  countTable: "community_posts" | "community_comments";
  countCol: "like_count" | "dislike_count";
};

const REACTION_META: Record<ReactionTarget, Record<ReactionKind, ReactionMeta>> = {
  post: {
    honor: { table: "post_honors", fk: "post_id", countTable: "community_posts", countCol: "like_count" },
    dislike: { table: "post_dislikes", fk: "post_id", countTable: "community_posts", countCol: "dislike_count" },
  },
  comment: {
    honor: { table: "comment_honors", fk: "comment_id", countTable: "community_comments", countCol: "like_count" },
    dislike: { table: "comment_dislikes", fk: "comment_id", countTable: "community_comments", countCol: "dislike_count" },
  },
};

async function existsReaction(
  target: ReactionTarget,
  kind: ReactionKind,
  targetId: string,
  userId: string,
): Promise<boolean> {
  const meta = REACTION_META[target][kind];
  const { data, error } = await createSupabaseServerClient()
    .from(meta.table)
    .select("id")
    .eq(meta.fk, targetId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** 현재 사용자의 대상에 대한 stance(명예/싫어요/없음). */
export const getUserReaction = cache(async function getUserReaction(params: {
  target: ReactionTarget;
  targetId: string;
  userId: string;
}): Promise<ReactionState> {
  if (!canQuerySupabase()) return null;
  if (await existsReaction(params.target, "honor", params.targetId, params.userId)) return "honor";
  if (await existsReaction(params.target, "dislike", params.targetId, params.userId)) return "dislike";
  return null;
});

/** 집계 카운트를 delta 만큼 증감(0 미만으로는 내려가지 않음). */
async function adjustCount(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  meta: ReactionMeta,
  id: string,
  delta: number,
): Promise<void> {
  const { data, error } = await supabase
    .from(meta.countTable)
    .select(meta.countCol)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const current = (data as Record<string, number> | null)?.[meta.countCol] ?? 0;
  await supabase
    .from(meta.countTable)
    .update({ [meta.countCol]: Math.max(0, current + delta) })
    .eq("id", id);
}

/**
 * 리액션 설정(토글 + 상호 배타).
 * 누른 버튼(kind)이 현재 stance 와 같으면 해제, 아니면 그 stance 로 전환한다.
 * 명예↔싫어요 전환 시 이전 행을 제거하고 새 행을 추가한다.
 * 반환된 before/after 로 호출부에서 작성자 LP 를 반영한다.
 */
export async function setReaction(params: {
  target: ReactionTarget;
  targetId: string;
  userId: string;
  kind: ReactionKind;
}): Promise<{ before: ReactionState; after: ReactionState }> {
  const before = await getUserReaction(params);
  const after: ReactionState = before === params.kind ? null : params.kind;
  if (before === after) return { before, after };

  const supabase = createSupabaseAdminClient();

  // 이전 stance 행 제거.
  if (before) {
    const meta = REACTION_META[params.target][before];
    const { error } = await supabase
      .from(meta.table)
      .delete()
      .eq(meta.fk, params.targetId)
      .eq("user_id", params.userId);
    if (error) throw error;
    await adjustCount(supabase, meta, params.targetId, -1);
  }

  // 새 stance 행 추가.
  if (after) {
    const meta = REACTION_META[params.target][after];
    const { error } = await supabase
      .from(meta.table)
      .insert({ [meta.fk]: params.targetId, user_id: params.userId });
    if (error) throw error;
    await adjustCount(supabase, meta, params.targetId, 1);
  }

  return { before, after };
}

/** 여러 댓글에 대한 현재 사용자 stance 를 한 번에 조회(상세 페이지 초기 상태용). */
export const getUserReactionsForComments = cache(async function getUserReactionsForComments(
  commentIds: string[],
  userId: string,
): Promise<Record<string, ReactionState>> {
  const result: Record<string, ReactionState> = {};
  if (!canQuerySupabase() || commentIds.length === 0) return result;
  const supabase = createSupabaseServerClient();

  const { data: honors, error: honorErr } = await supabase
    .from("comment_honors")
    .select("comment_id")
    .in("comment_id", commentIds)
    .eq("user_id", userId);
  if (honorErr) throw honorErr;
  for (const row of (honors ?? []) as { comment_id: string }[]) {
    result[row.comment_id] = "honor";
  }

  const { data: dislikes, error: dislikeErr } = await supabase
    .from("comment_dislikes")
    .select("comment_id")
    .in("comment_id", commentIds)
    .eq("user_id", userId);
  if (dislikeErr) throw dislikeErr;
  for (const row of (dislikes ?? []) as { comment_id: string }[]) {
    result[row.comment_id] = "dislike";
  }

  return result;
});

/** 리폿 생성. post 또는 comment 중 하나를 대상으로. report_count 증가(글 대상일 때). */
export async function createReport(params: {
  postId?: string | null;
  commentId?: string | null;
  reporterId: string;
  reason?: string | null;
}): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("post_reports")
    .insert({
      post_id: params.postId ?? null,
      comment_id: params.commentId ?? null,
      reporter_id: params.reporterId,
      reason: params.reason ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;

  if (params.postId) {
    const post = await getPostById(params.postId);
    if (post) {
      await supabase
        .from("community_posts")
        .update({ report_count: post.reportCount + 1 })
        .eq("id", params.postId);
    }
  }

  return { id: (data as { id: string }).id };
}

// ── 운영 설정 / 인기글 승격 / 자동 블라인드 ──────────────────────────────

/** 스코프별 커뮤니티 운영 설정. DB 조회 실패 시 기본값으로 동작한다. */
export type CommunitySettings = {
  /** 인기글 등재 컷: 명예 - 싫어요 가 이 값 이상이면 hot_at 스냅샷. */
  hotCut: number;
  /** 자동 블라인드 임계값: 서로 다른 이용자의 미처리 신고가 이 수에 도달하면 블라인드. */
  blindReportCount: number;
};

const DEFAULT_COMMUNITY_SETTINGS: CommunitySettings = { hotCut: 5, blindReportCount: 3 };

export const getCommunitySettings = cache(async function getCommunitySettings(
  scope: BoardScope,
): Promise<CommunitySettings> {
  if (!canQuerySupabase()) return DEFAULT_COMMUNITY_SETTINGS;

  const { data, error } = await createSupabaseServerClient()
    .from("community_settings")
    .select("hot_cut, blind_report_count")
    .eq("scope", scope)
    .maybeSingle();

  if (error || !data) return DEFAULT_COMMUNITY_SETTINGS;
  const row = data as { hot_cut: number; blind_report_count: number };
  return { hotCut: row.hot_cut, blindReportCount: row.blind_report_count };
});

/**
 * 인기글 승격 판정(리액션 변경 후 호출).
 * 명예 - 싫어요 가 스코프 컷 이상이면 hot_at 을 기록한다.
 * 한 번 등재되면 이후 싫어요가 늘어도 유지된다(스냅샷 — 등락 방지).
 * 블라인드/삭제 상태의 글은 승격하지 않는다.
 */
export async function promotePostIfHot(postId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, site_scope, like_count, dislike_count, hot_at, blinded_at, deleted_at")
    .eq("id", postId)
    .maybeSingle();
  if (error || !data) return false;

  const row = data as Pick<
    PostRow,
    "id" | "site_scope" | "like_count" | "dislike_count" | "hot_at" | "blinded_at" | "deleted_at"
  >;
  if (row.hot_at || row.blinded_at || row.deleted_at) return false;

  const settings = await getCommunitySettings(row.site_scope);
  const net = row.like_count - (row.dislike_count ?? 0);
  if (net < settings.hotCut) return false;

  await supabase
    .from("community_posts")
    .update({ hot_at: new Date().toISOString() })
    .eq("id", postId);
  return true;
}

/**
 * 신고 누적 자동 블라인드 판정(신고 접수 후 호출).
 * 대상의 미처리(pending) 신고 수가 임계값 이상이면 blinded_at 을 기록한다.
 * 신고는 신고자별 유니크(중복 불가)라 행 수 = 서로 다른 신고자 수다.
 * 반환값: 이번 호출로 "새로" 블라인드됐는지(알림 중복 방지용). 누적 신고 수도 함께 돌려준다.
 */
export async function blindTargetIfReported(params: {
  scope: BoardScope;
  postId?: string | null;
  commentId?: string | null;
}): Promise<{ newlyBlinded: boolean; reportCount: number }> {
  const supabase = createSupabaseAdminClient();
  const fk = params.postId ? "post_id" : "comment_id";
  const targetId = params.postId ?? params.commentId;
  if (!targetId) return { newlyBlinded: false, reportCount: 0 };

  const { count, error } = await supabase
    .from("post_reports")
    .select("id", { count: "exact", head: true })
    .eq(fk, targetId)
    .eq("status", "pending");
  if (error || count === null) return { newlyBlinded: false, reportCount: 0 };

  const settings = await getCommunitySettings(params.scope);
  if (count < settings.blindReportCount) return { newlyBlinded: false, reportCount: count };

  const table = params.postId ? "community_posts" : "community_comments";
  const { data: updated } = await supabase
    .from(table)
    .update({ blinded_at: new Date().toISOString(), blinded_source: "report" })
    .eq("id", targetId)
    .is("blinded_at", null)
    .select("id");
  return { newlyBlinded: (updated ?? []).length > 0, reportCount: count };
}

/**
 * AI 검수 위반 판정 적용: 대상 블라인드 + 신고함에 AI 신고 행 등록.
 * 자동 조치는 블라인드까지만 — 삭제/LP 차감은 어드민 신고함에서 사람이 확정한다.
 * 같은 대상에 미처리 AI 신고가 이미 있으면 중복 등록하지 않는다(수정 재검수 대비).
 * 반환값: 이번 호출로 "새로" 등록됐는지(알림 중복 방지용).
 */
export async function applyAiFlag(params: {
  postId?: string | null;
  commentId?: string | null;
  category: string;
  detail?: string;
}): Promise<boolean> {
  const targetId = params.postId ?? params.commentId;
  if (!targetId) return false;

  const supabase = createSupabaseAdminClient();
  const fk = params.postId ? "post_id" : "comment_id";
  const table = params.postId ? "community_posts" : "community_comments";

  await supabase
    .from(table)
    .update({ blinded_at: new Date().toISOString(), blinded_source: "ai" })
    .eq("id", targetId)
    .is("blinded_at", null);

  const { data: existing } = await supabase
    .from("post_reports")
    .select("id")
    .eq(fk, targetId)
    .eq("source", "ai")
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (existing) return false;

  const reason = params.detail
    ? `[${AI_MODERATOR_NAME}] ${params.category} — ${params.detail}`
    : `[${AI_MODERATOR_NAME}] ${params.category}`;
  const { error } = await supabase.from("post_reports").insert({
    post_id: params.postId ?? null,
    comment_id: params.commentId ?? null,
    reporter_id: null,
    source: "ai",
    reason,
  });
  if (error) {
    console.warn("[ai-moderation] AI 신고 등록 실패", error.message);
    return false;
  }
  return true;
}

/** 단건 댓글 조회(리폿 대상 작성자 확인용). */
export const getCommentById = cache(async function getCommentById(
  commentId: string,
): Promise<CommunityCommentItem | null> {
  if (!canQuerySupabase()) return null;

  const { data, error } = await createSupabaseServerClient()
    .from("community_comments")
    .select(COMMENT_COLUMNS)
    .eq("id", commentId)
    .maybeSingle();

  if (error) throw error;
  return data ? (await mapCommentsWithAuthors([data as CommentRow]))[0] ?? null : null;
});
