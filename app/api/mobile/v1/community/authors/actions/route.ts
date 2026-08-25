import type { MobileCommunityActionDto } from "@/packages/contracts/src/mobile-v1";
import { getCommentById, getPostById } from "@/lib/data/community";
import { getCommunityUserSummary, isCommunityUserSanctioned } from "@/lib/data/community-users";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function uniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

async function evidence(body: Record<string, unknown> | null) {
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  if (!targetId) return null;
  return body?.target === "comment" ? getCommentById(targetId) : body?.target === "post" ? getPostById(targetId) : null;
}

export async function POST(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  if (await isCommunityUserSanctioned(auth.user.id)) {
    return mobileError("FORBIDDEN", "커뮤니티 이용이 영구 제한된 계정입니다.", 403);
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action === "block" ? "block" : body?.action === "report" ? "report" : null;
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : null;
  const related = await evidence(body);
  if (!action) return mobileError("BAD_REQUEST", "처리할 작업을 확인해 주세요.", 400);
  if (targetUserId === auth.user.id) return mobileError("FORBIDDEN", "자기 자신은 처리할 수 없습니다.", 403);
  if (targetUserId && related && related.authorId !== targetUserId) {
    return mobileError("BAD_REQUEST", "작성자와 관련 활동이 일치하지 않습니다.", 400);
  }

  const admin = createSupabaseAdminClient();
  if (action === "block") {
    try {
      if (targetUserId) {
        if (!(await getCommunityUserSummary(targetUserId))) return mobileError("NOT_FOUND", "사용자를 찾을 수 없습니다.", 404);
        const result = await admin.from("community_user_blocks").insert({ blocked_id: targetUserId, blocker_id: auth.user.id });
        if (result.error && !uniqueViolation(result.error)) throw result.error;
      } else {
        if (!related?.guestKey) return mobileError("NOT_FOUND", "비회원 작성자를 찾을 수 없습니다.", 404);
        const result = await admin.from("community_guest_blocks").insert({
          blocker_id: auth.user.id,
          guest_key: related.guestKey,
          guest_nickname: related.authorName ?? "비회원",
        });
        if (result.error && !uniqueViolation(result.error)) throw result.error;
      }
      const data: MobileCommunityActionDto = { message: targetUserId ? "이 사용자의 글과 댓글을 숨겼습니다." : "이 비회원의 글과 댓글을 내 화면에서 숨겼습니다." };
      return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
      return mobileError("INTERNAL", "사용자를 차단하지 못했습니다.", 500);
    }
  }

  if (!targetUserId || !(await getCommunityUserSummary(targetUserId))) {
    return mobileError("NOT_FOUND", "신고할 사용자를 찾을 수 없습니다.", 404);
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) return mobileError("BAD_REQUEST", "신고 사유를 입력해주세요.", 400);
  if (reason.length > 1000) return mobileError("BAD_REQUEST", "신고 사유는 1,000자까지 입력할 수 있습니다.", 400);
  const report = await admin.from("community_user_reports").insert({
    evidence_comment_id: body?.target === "comment" ? body.targetId : null,
    evidence_post_id: body?.target === "post" ? body.targetId : null,
    reason,
    reporter_id: auth.user.id,
    target_user_id: targetUserId,
  });
  if (uniqueViolation(report.error)) return mobileError("CONFLICT", "이미 처리 대기 중인 사용자 신고가 있습니다.", 409);
  if (report.error) return mobileError("INTERNAL", "사용자 신고를 접수하지 못했습니다.", 500);
  const data: MobileCommunityActionDto = { message: "사용자 신고가 접수됐습니다." };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
