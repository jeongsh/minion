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
import type { ActionResult } from "@/lib/community/types";
import {
  createComment,
  createPost,
  createReport,
  getCommentById,
  getPostById,
  hasHonored,
  toggleHonor,
} from "@/lib/data/community";

const LOGIN_REQUIRED: ActionResult = {
  ok: false,
  error: "로그인이 필요합니다.",
  requiresLogin: true,
};

/** 보드 베이스 경로(revalidate 용). */
function boardBasePath(scope: BoardScope, teamSlug: string | undefined, boardType: string): string {
  return scope === "team" && teamSlug
    ? `/fan/${teamSlug}/community/${boardType}`
    : `/community/${boardType}`;
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

  revalidatePath(boardBasePath(input.scope, input.teamSlug, input.boardType));
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

/** 명예(토글). 자기 글 명예 금지. */
export async function toggleHonorAction(input: {
  postId: string;
  scope: BoardScope;
  teamSlug?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;

  const post = await getPostById(input.postId);
  if (!post) return { ok: false, error: "글을 찾을 수 없습니다." };
  if (post.authorId && post.authorId === user.id) {
    return { ok: false, error: "자기 글에는 명예를 줄 수 없습니다." };
  }

  const { added } = await toggleHonor({ postId: input.postId, userId: user.id });

  if (post.authorId) {
    await recordLpEvent({
      userId: post.authorId,
      reason: added ? "honor_received" : "honor_removed",
      postId: input.postId,
    });
  }

  revalidatePath(postPath(input.scope, input.teamSlug, input.postId));
  return { ok: true, message: added ? "명예를 부여했습니다." : "명예를 취소했습니다." };
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

/** 현재 사용자가 해당 글에 명예를 줬는지(UI 초기 상태). */
export async function getHonorState(postId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return hasHonored(postId, user.id);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
