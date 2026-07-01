"use server";

// 게시판 서버 액션.
// - 모든 쓰기는 비로그인 시 차단(로그인 유도).
// - author_id/user_id 는 항상 getCurrentUser().id 로 채운다.
// - 행동 발생 시 recordLpEvent 를 호출한다.

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/current-user";
import { recordLpEvent } from "@/lib/rank/record-lp";
import type { BoardScope } from "@/lib/community/boards";
import { getBoard } from "@/lib/community/boards";
import type {
  ActionResult,
  ReactionKind,
  ReactionState,
  ReactionTarget,
} from "@/lib/community/types";
import {
  createComment,
  createPost,
  createReport,
  getCommentById,
  getPostById,
  getUserReaction,
  getUserReactionsForComments,
  setReaction,
} from "@/lib/data/community";

const LOGIN_REQUIRED: ActionResult = {
  ok: false,
  error: "로그인이 필요합니다.",
  requiresLogin: true,
};

/** 리액션 액션 결과. 성공 시 최종 stance(state)를 돌려줘 클라이언트 UI 동기화에 쓴다. */
export type ReactionActionResult =
  | { ok: true; state: ReactionState }
  | { ok: false; error: string; requiresLogin?: boolean };

/** 커뮤니티 피드 인덱스 경로(revalidate 용). 단일 피드라 말머리 구분 없이 인덱스만 갱신. */
function communityIndexPath(scope: BoardScope, teamSlug: string | undefined): string {
  return scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : `/community`;
}

function postPath(scope: BoardScope, teamSlug: string | undefined, postId: string): string {
  return scope === "team" && teamSlug
    ? `/fan/${teamSlug}/community/post/${postId}`
    : `/community/post/${postId}`;
}

/** 글 작성. */
export async function createPostAction(input: {
  scope: BoardScope;
  boardType: string;
  teamId?: string | null;
  teamSlug?: string;
  title: string;
  content: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;

  const board = getBoard(input.scope, input.boardType);
  if (!board) return { ok: false, error: "존재하지 않는 게시판입니다." };

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) return { ok: false, error: "제목을 입력하세요." };
  if (!content) return { ok: false, error: "내용을 입력하세요." };

  const { id } = await createPost({
    scope: input.scope,
    boardType: input.boardType,
    teamId: input.teamId,
    title,
    content,
    authorId: user.id,
  });

  await recordLpEvent({ userId: user.id, reason: "post_created", postId: id });

  revalidatePath(communityIndexPath(input.scope, input.teamSlug));
  return { ok: true, message: "작성되었습니다." };
}

/** 댓글 작성. */
export async function createCommentAction(input: {
  postId: string;
  content: string;
  scope: BoardScope;
  teamSlug?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;

  const content = input.content.trim();
  if (!content) return { ok: false, error: "댓글 내용을 입력하세요." };

  const { id } = await createComment({
    postId: input.postId,
    content,
    authorId: user.id,
  });

  await recordLpEvent({ userId: user.id, reason: "comment_created", commentId: id });

  revalidatePath(postPath(input.scope, input.teamSlug, input.postId));
  return { ok: true, message: "댓글이 등록되었습니다." };
}

/**
 * 리액션(명예/싫어요) 토글. 글·댓글 공용.
 * - 자기 글/댓글에도 누를 수 있다(제한 없음).
 * - 명예↔싫어요는 상호 배타(전환 시 이전 stance 자동 해제).
 * - 대상 작성자의 LP 를 stance 변화에 맞춰 반영한다.
 *   싫어요를 받으면(작성자 기준) LP 가 떨어진다(dishonor_received).
 */
export async function reactAction(input: {
  target: ReactionTarget;
  targetId: string;
  kind: ReactionKind;
  postId: string; // revalidate 용(댓글이면 소속 글 id).
  scope: BoardScope;
  teamSlug?: string;
}): Promise<ReactionActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다.", requiresLogin: true };

  // 대상 작성자(LP 반영 대상) 확인.
  const authorId =
    input.target === "post"
      ? (await getPostById(input.targetId))?.authorId ?? null
      : (await getCommentById(input.targetId))?.authorId ?? null;

  const { before, after } = await setReaction({
    target: input.target,
    targetId: input.targetId,
    userId: user.id,
    kind: input.kind,
  });

  // 작성자 LP 반영. 명예↔싫어요 전환 시 취소+획득 두 이벤트가 함께 발생할 수 있다.
  if (authorId && before !== after) {
    const ref = input.target === "post"
      ? { postId: input.targetId }
      : { commentId: input.targetId };
    if (before === "honor") await recordLpEvent({ userId: authorId, reason: "honor_removed", ...ref });
    if (before === "dislike") await recordLpEvent({ userId: authorId, reason: "dishonor_removed", ...ref });
    if (after === "honor") await recordLpEvent({ userId: authorId, reason: "honor_received", ...ref });
    if (after === "dislike") await recordLpEvent({ userId: authorId, reason: "dishonor_received", ...ref });
  }

  revalidatePath(postPath(input.scope, input.teamSlug, input.postId));
  return { ok: true, state: after };
}

/** 리폿(글). 본인 글 리폿 금지, 중복 리폿 방지. */
export async function reportPostAction(input: {
  postId: string;
  reason?: string;
  scope: BoardScope;
  teamSlug?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;

  const post = await getPostById(input.postId);
  if (!post) return { ok: false, error: "글을 찾을 수 없습니다." };
  if (post.authorId && post.authorId === user.id) {
    return { ok: false, error: "자기 글은 리폿할 수 없습니다." };
  }

  try {
    await createReport({
      postId: input.postId,
      reporterId: user.id,
      reason: input.reason,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "이미 리폿한 글입니다." };
    }
    throw error;
  }

  if (post.authorId) {
    await recordLpEvent({
      userId: post.authorId,
      reason: "reported",
      postId: input.postId,
    });
  }

  revalidatePath(postPath(input.scope, input.teamSlug, input.postId));
  return { ok: true, message: "리폿이 접수되었습니다." };
}

/** 리폿(댓글). 본인 댓글 리폿 금지, 중복 리폿 방지. */
export async function reportCommentAction(input: {
  commentId: string;
  postId: string;
  reason?: string;
  scope: BoardScope;
  teamSlug?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;

  const comment = await getCommentById(input.commentId);
  if (!comment) return { ok: false, error: "댓글을 찾을 수 없습니다." };
  if (comment.authorId && comment.authorId === user.id) {
    return { ok: false, error: "자기 댓글은 리폿할 수 없습니다." };
  }

  try {
    await createReport({
      commentId: input.commentId,
      reporterId: user.id,
      reason: input.reason,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "이미 리폿한 댓글입니다." };
    }
    throw error;
  }

  if (comment.authorId) {
    await recordLpEvent({
      userId: comment.authorId,
      reason: "reported",
      commentId: input.commentId,
    });
  }

  revalidatePath(postPath(input.scope, input.teamSlug, input.postId));
  return { ok: true, message: "리폿이 접수되었습니다." };
}

/** 현재 사용자의 글 stance(명예/싫어요/없음). UI 초기 상태. */
export async function getPostReactionState(postId: string): Promise<ReactionState> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getUserReaction({ target: "post", targetId: postId, userId: user.id });
}

/** 현재 사용자의 댓글별 stance 맵. UI 초기 상태. */
export async function getCommentReactionStates(
  commentIds: string[],
): Promise<Record<string, ReactionState>> {
  const user = await getCurrentUser();
  if (!user || commentIds.length === 0) return {};
  return getUserReactionsForComments(commentIds, user.id);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
