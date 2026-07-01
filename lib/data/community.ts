// 게시판 트랙 데이터 계층(읽기/쓰기).
// lib/data/lck.ts 의 읽기 함수와 별개로 이 트랙 전용 read/write 를 둔다.
// 쓰기는 항상 author_id/user_id 를 getCurrentUser().id 로 채운다(서버 액션에서 사용).

import { canQuerySupabase, createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractPlainText, extractThumbnail } from "@/lib/community/extract-thumbnail";
import type { BoardScope } from "@/lib/community/boards";
import type {
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
};

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string | null;
  content: string;
  like_count: number;
  dislike_count: number | null;
  created_at: string;
};

const POST_COLUMNS =
  "id, board_type, site_scope, team_id, title, content, author_id, like_count, dislike_count, comment_count, view_count, report_count, created_at";

const COMMENT_COLUMNS =
  "id, post_id, author_id, content, like_count, dislike_count, created_at";

function mapPost(row: PostRow): CommunityPostDetail {
  return {
    id: row.id,
    boardType: row.board_type,
    siteScope: row.site_scope,
    teamId: row.team_id,
    title: row.title,
    content: row.content,
    authorId: row.author_id,
    likeCount: row.like_count,
    dislikeCount: row.dislike_count ?? 0,
    commentCount: row.comment_count,
    viewCount: row.view_count,
    reportCount: row.report_count ?? 0,
    createdAt: row.created_at,
    thumbnailUrl: extractThumbnail(row.content),
    excerpt: extractPlainText(row.content),
  };
}

function mapComment(row: CommentRow): CommunityCommentItem {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    content: row.content,
    likeCount: row.like_count,
    dislikeCount: row.dislike_count ?? 0,
    createdAt: row.created_at,
  };
}

/**
 * 커뮤니티 글 목록 조회(단일 피드).
 * boardType 미지정 시 전체 말머리 글을 한 번에 조회(전체 탭).
 * teamId 는 team scope 에서만 사용.
 */
export async function getBoardPosts(params: {
  scope: BoardScope;
  boardType?: string | null;
  teamId?: string | null;
}): Promise<CommunityPostDetail[]> {
  if (!canQuerySupabase()) return [];

  let query = createSupabaseServerClient()
    .from("community_posts")
    .select(POST_COLUMNS)
    .eq("site_scope", params.scope)
    .order("created_at", { ascending: false });

  if (params.boardType) {
    query = query.eq("board_type", params.boardType);
  }

  if (params.scope === "team" && params.teamId) {
    query = query.eq("team_id", params.teamId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as PostRow[]).map(mapPost);
}

/** 단건 조회(조회수 증가 X — 순수 조회). */
export async function getPostById(postId: string): Promise<CommunityPostDetail | null> {
  if (!canQuerySupabase()) return null;

  const { data, error } = await createSupabaseServerClient()
    .from("community_posts")
    .select(POST_COLUMNS)
    .eq("id", postId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPost(data as PostRow) : null;
}

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
      await createSupabaseAdminClient()
        .from("community_posts")
        .update({ view_count: post.viewCount + 1 })
        .eq("id", postId);
    } catch {
      return post;
    }
  } else {
    return post;
  }

  return { ...post, viewCount: post.viewCount + 1 };
}

/** 댓글 목록 조회(오래된 순). */
export async function getPostComments(postId: string): Promise<CommunityCommentItem[]> {
  if (!canQuerySupabase()) return [];

  const { data, error } = await createSupabaseServerClient()
    .from("community_comments")
    .select(COMMENT_COLUMNS)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as CommentRow[]).map(mapComment);
}

/** 글 생성. author_id 는 호출부(서버 액션)에서 getCurrentUser().id 로 전달. */
export async function createPost(params: {
  scope: BoardScope;
  boardType: string;
  teamId?: string | null;
  title: string;
  content: string;
  authorId: string;
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
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: (data as { id: string }).id };
}

/** 댓글 생성. comment_count 증가도 함께 처리. */
export async function createComment(params: {
  postId: string;
  content: string;
  authorId: string;
}): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("community_comments")
    .insert({
      post_id: params.postId,
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
export async function getUserReaction(params: {
  target: ReactionTarget;
  targetId: string;
  userId: string;
}): Promise<ReactionState> {
  if (!canQuerySupabase()) return null;
  if (await existsReaction(params.target, "honor", params.targetId, params.userId)) return "honor";
  if (await existsReaction(params.target, "dislike", params.targetId, params.userId)) return "dislike";
  return null;
}

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
export async function getUserReactionsForComments(
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
}

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

/** 단건 댓글 조회(리폿 대상 작성자 확인용). */
export async function getCommentById(commentId: string): Promise<CommunityCommentItem | null> {
  if (!canQuerySupabase()) return null;

  const { data, error } = await createSupabaseServerClient()
    .from("community_comments")
    .select(COMMENT_COLUMNS)
    .eq("id", commentId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapComment(data as CommentRow) : null;
}
