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
  created_at: string;
};

const POST_COLUMNS =
  "id, board_type, site_scope, team_id, title, content, author_id, like_count, comment_count, view_count, report_count, created_at";

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
    .select("id, post_id, author_id, content, like_count, created_at")
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

/** 사용자가 이미 명예를 줬는지 여부. */
export async function hasHonored(postId: string, userId: string): Promise<boolean> {
  if (!canQuerySupabase()) return false;

  const { data, error } = await createSupabaseServerClient()
    .from("post_honors")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/**
 * 명예 토글. added=true 면 추가, false 면 취소.
 * like_count 를 명예 수로 함께 갱신한다.
 */
export async function toggleHonor(params: {
  postId: string;
  userId: string;
}): Promise<{ added: boolean }> {
  const supabase = createSupabaseAdminClient();
  const already = await hasHonored(params.postId, params.userId);
  const post = await getPostById(params.postId);
  const currentCount = post?.likeCount ?? 0;

  if (already) {
    const { error } = await supabase
      .from("post_honors")
      .delete()
      .eq("post_id", params.postId)
      .eq("user_id", params.userId);
    if (error) throw error;

    await supabase
      .from("community_posts")
      .update({ like_count: Math.max(0, currentCount - 1) })
      .eq("id", params.postId);

    return { added: false };
  }

  const { error } = await supabase.from("post_honors").insert({
    post_id: params.postId,
    user_id: params.userId,
  });
  if (error) throw error;

  await supabase
    .from("community_posts")
    .update({ like_count: currentCount + 1 })
    .eq("id", params.postId);

  return { added: true };
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
    .select("id, post_id, author_id, content, like_count, created_at")
    .eq("id", commentId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapComment(data as CommentRow) : null;
}
