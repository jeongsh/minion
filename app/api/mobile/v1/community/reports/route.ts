import type { MobileCommunityActionDto } from "@/packages/contracts/src/mobile-v1";
import { blindTargetIfReported, createReport, getCommentById, getPostById } from "@/lib/data/community";
import { isCommunityGuestSanctioned } from "@/lib/data/community-guests";
import { isCommunityUserSanctioned } from "@/lib/data/community-users";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileCommunityActor } from "@/lib/mobile/community";

export const dynamic = "force-dynamic";

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

export async function POST(request: Request) {
  const actor = await getMobileCommunityActor(request).catch(() => null);
  if (!actor) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);
  if (actor.auth && await isCommunityUserSanctioned(actor.auth.user.id)) return mobileError("FORBIDDEN", "커뮤니티 이용이 영구 제한된 계정입니다.", 403);
  if (!actor.auth && await isCommunityGuestSanctioned(actor.guest.key, actor.guest.ipKey)) return mobileError("FORBIDDEN", "이 비회원 ID 또는 접속 환경은 커뮤니티 이용이 제한되었습니다.", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const target = body?.target === "comment" ? "comment" : body?.target === "post" ? "post" : null;
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!target || !targetId) return mobileError("BAD_REQUEST", "리폿 대상을 확인해 주세요.", 400);
  if (!reason) return mobileError("BAD_REQUEST", "리폿 사유를 입력해주세요.", 400);
  if (reason.length > 1_000) return mobileError("BAD_REQUEST", "리폿 사유는 1,000자까지 입력할 수 있습니다.", 400);
  const item = target === "post" ? await getPostById(targetId) : await getCommentById(targetId);
  if (!item) return mobileError("NOT_FOUND", "리폿 대상을 찾을 수 없습니다.", 404);
  if (
    (item.authorId && item.authorId === actor.auth?.user.id)
    || (item.guestKey && item.guestKey === actor.guest.key)
  ) return mobileError("FORBIDDEN", `자기 ${target === "post" ? "글" : "댓글"}은 리폿할 수 없습니다.`, 403);
  try {
    await createReport({
      commentId: target === "comment" ? targetId : null,
      postId: target === "post" ? targetId : null,
      reason,
      ...(actor.auth ? { reporterId: actor.auth.user.id } : { reporterGuestKey: actor.guest.key }),
    });
    await blindTargetIfReported({
      commentId: target === "comment" ? targetId : null,
      postId: target === "post" ? targetId : null,
      scope: target === "post" && "siteScope" in item ? item.siteScope : (body?.scope === "team" ? "team" : "hub"),
    });
    const data: MobileCommunityActionDto = { message: "리폿이 접수되었습니다." };
    return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (isUniqueViolation(error)) return mobileError("CONFLICT", `이미 리폿한 ${target === "post" ? "글" : "댓글"}입니다.`, 409);
    return mobileError("INTERNAL", "리폿을 접수하지 못했습니다.", 500);
  }
}
