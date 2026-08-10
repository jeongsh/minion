"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/current-user";
import type { ActionResult } from "@/lib/community/types";
import { getCommentById, getPostById } from "@/lib/data/community";
import {
  createCommunityUserReport,
  getCommunityUserSummary,
  isCommunityUserSanctioned,
  setCommunityUserBlocked,
} from "@/lib/data/community-users";

const LOGIN_REQUIRED: ActionResult = {
  ok: false,
  error: "로그인이 필요합니다.",
  requiresLogin: true,
};

export async function setCommunityUserBlockedAction(input: {
  targetUserId: string;
  blocked: boolean;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (user.id === input.targetUserId) {
    return { ok: false, error: "자기 자신은 차단할 수 없습니다." };
  }
  if (!(await getCommunityUserSummary(input.targetUserId))) {
    return { ok: false, error: "사용자를 찾을 수 없습니다." };
  }

  await setCommunityUserBlocked({
    blockerId: user.id,
    blockedId: input.targetUserId,
    blocked: input.blocked,
  });
  revalidatePath("/community", "layout");
  revalidatePath("/me", "layout");
  return {
    ok: true,
    message: input.blocked ? "이 사용자의 글과 댓글을 숨겼습니다." : "차단을 해제했습니다.",
  };
}

export async function reportCommunityUserAction(input: {
  targetUserId: string;
  reason?: string;
  evidencePostId?: string;
  evidenceCommentId?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;
  if (await isCommunityUserSanctioned(user.id)) {
    return { ok: false, error: "커뮤니티 이용이 영구 제한된 계정입니다." };
  }
  if (user.id === input.targetUserId) {
    return { ok: false, error: "자기 자신은 신고할 수 없습니다." };
  }
  if (!(await getCommunityUserSummary(input.targetUserId))) {
    return { ok: false, error: "사용자를 찾을 수 없습니다." };
  }

  const reason = input.reason?.trim() || "커뮤니티 이용자 신고";
  if (reason.length > 1000) {
    return { ok: false, error: "신고 사유는 1,000자까지 입력할 수 있습니다." };
  }

  if (input.evidencePostId) {
    const post = await getPostById(input.evidencePostId);
    if (!post || post.authorId !== input.targetUserId) {
      return { ok: false, error: "신고 대상과 관련 게시글이 일치하지 않습니다." };
    }
  }
  if (input.evidenceCommentId) {
    const comment = await getCommentById(input.evidenceCommentId);
    if (!comment || comment.authorId !== input.targetUserId) {
      return { ok: false, error: "신고 대상과 관련 댓글이 일치하지 않습니다." };
    }
  }

  try {
    await createCommunityUserReport({
      reporterId: user.id,
      targetUserId: input.targetUserId,
      reason,
      evidencePostId: input.evidencePostId,
      evidenceCommentId: input.evidenceCommentId,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "이미 처리 대기 중인 사용자 신고가 있습니다." };
    }
    throw error;
  }

  return { ok: true, message: "사용자 신고가 접수됐습니다." };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
