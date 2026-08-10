"use server";

// 커뮤니티 운영(모더레이션) 서버 액션.
// 신고 처리 원칙: 접수 시점에는 LP 를 건드리지 않고, 운영자가 "제재 확정"한 시점에만
// 작성자 LP 를 차감한다(reason: "reported"). 기각 시에는 블라인드를 해제해 오판을 복구한다.

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import { recordLpEvent } from "@/lib/rank/record-lp";
import type { BoardScope } from "@/lib/community/boards";
import {
  dismissCommunityUserReport,
  liftCommunityUserSanction,
  resolveReports,
  sanctionCommunityUser,
  setCommentBlinded,
  setPostBlinded,
  setPostDeleted,
  setPostNotice,
  softDeleteComment,
  updateCommunitySettings,
} from "@/lib/data/community-admin";

// 모더레이션 결과는 피드/상세/홈 등 여러 화면에 걸쳐 보이므로 전체를 무효화한다.
function revalidateCommunity() {
  revalidatePath("/", "layout");
}

/** 신고 제재 확정: 신고 confirmed + 블라인드 유지 + 작성자 LP 차감(1회). */
export async function confirmReportsAction(formData: FormData) {
  await requireAdmin();
  const postId = (formData.get("post_id") as string) || null;
  const commentId = (formData.get("comment_id") as string) || null;
  if (!postId && !commentId) return;

  const { authorId } = await resolveReports({ postId, commentId, action: "confirm" });
  if (authorId) {
    await recordLpEvent({
      userId: authorId,
      reason: "reported",
      postId: postId ?? undefined,
      commentId: commentId ?? undefined,
    });
  }
  revalidateCommunity();
}

/** 신고 기각: 신고 dismissed + 블라인드 해제. */
export async function dismissReportsAction(formData: FormData) {
  await requireAdmin();
  const postId = (formData.get("post_id") as string) || null;
  const commentId = (formData.get("comment_id") as string) || null;
  if (!postId && !commentId) return;

  await resolveReports({ postId, commentId, action: "dismiss" });
  revalidateCommunity();
}

export async function setPostBlindedAction(formData: FormData) {
  await requireAdmin();
  const postId = formData.get("post_id") as string;
  const blinded = formData.get("blinded") === "true";
  if (!postId) return;
  await setPostBlinded(postId, blinded);
  revalidateCommunity();
}

export async function setCommentBlindedAction(formData: FormData) {
  await requireAdmin();
  const commentId = formData.get("comment_id") as string;
  const blinded = formData.get("blinded") === "true";
  if (!commentId) return;
  await setCommentBlinded(commentId, blinded);
  revalidateCommunity();
}

export async function setPostNoticeAction(formData: FormData) {
  await requireAdmin();
  const postId = formData.get("post_id") as string;
  const isNotice = formData.get("is_notice") === "true";
  if (!postId) return;
  await setPostNotice(postId, isNotice);
  revalidateCommunity();
}

export async function setPostDeletedAction(formData: FormData) {
  await requireAdmin();
  const postId = formData.get("post_id") as string;
  const deleted = formData.get("deleted") === "true";
  if (!postId) return;
  await setPostDeleted(postId, deleted);
  revalidateCommunity();
}

export async function softDeleteCommentAction(formData: FormData) {
  await requireAdmin();
  const commentId = formData.get("comment_id") as string;
  if (!commentId) return;
  await softDeleteComment(commentId);
  revalidateCommunity();
}

export async function updateCommunitySettingsAction(formData: FormData) {
  await requireAdmin();
  const scope = formData.get("scope") as BoardScope;
  if (scope !== "hub" && scope !== "team") return;

  const hotCut = Number(formData.get("hot_cut"));
  const blindReportCount = Number(formData.get("blind_report_count"));
  if (!Number.isInteger(hotCut) || hotCut < 1 || hotCut > 1000) return;
  if (!Number.isInteger(blindReportCount) || blindReportCount < 1 || blindReportCount > 100) return;

  await updateCommunitySettings(scope, { hotCut, blindReportCount });
  revalidateCommunity();
}

export async function sanctionCommunityUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const reportId = String(formData.get("report_id") ?? "") || null;
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId || !reason || reason.length > 1000) return;

  await sanctionCommunityUser({ userId, reason, adminId: admin.id, reportId });
  revalidateCommunity();
}

export async function dismissCommunityUserReportAction(formData: FormData) {
  const admin = await requireAdmin();
  const reportId = String(formData.get("report_id") ?? "");
  if (!reportId) return;
  await dismissCommunityUserReport(reportId, admin.id);
  revalidateCommunity();
}

export async function liftCommunityUserSanctionAction(formData: FormData) {
  const admin = await requireAdmin();
  const sanctionId = String(formData.get("sanction_id") ?? "");
  if (!sanctionId) return;
  await liftCommunityUserSanction(sanctionId, admin.id);
  revalidateCommunity();
}
