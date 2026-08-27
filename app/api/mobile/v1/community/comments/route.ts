import type { MobileCommunityCommentMutationDto } from "@/packages/contracts/src/mobile-v1";
import { createComment, getCommentById, getPostById } from "@/lib/data/community";
import { guestRateLimitError, isCommunityGuestSanctioned } from "@/lib/data/community-guests";
import { isCommunityUserSanctioned } from "@/lib/data/community-users";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import {
  getMobileCommunityActor,
  scheduleMobileCommunityModeration,
  validateMobileCommentInput,
} from "@/lib/mobile/community";
import { recordLpEvent } from "@/lib/rank/record-lp";
import { scheduleCommunityCommentNotifications } from "@/lib/notifications/community";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await getMobileCommunityActor(request).catch(() => null);
  if (!actor) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const postId = typeof body?.postId === "string" ? body.postId : "";
  const parentId = typeof body?.parentId === "string" ? body.parentId : null;
  const post = await getPostById(postId);
  if (!post) return mobileError("NOT_FOUND", "게시글을 찾을 수 없습니다.", 404);
  if (parentId) {
    const parent = await getCommentById(parentId);
    if (!parent || parent.postId !== postId) return mobileError("BAD_REQUEST", "답글을 작성할 댓글을 찾을 수 없습니다.", 400);
  }
  const validated = validateMobileCommentInput(body?.content);
  if (!validated.ok) return mobileError("BAD_REQUEST", validated.error, 400);
  if (actor.auth && await isCommunityUserSanctioned(actor.auth.user.id)) {
    return mobileError("FORBIDDEN", "커뮤니티 이용이 영구 제한된 계정입니다.", 403);
  }
  if (!actor.auth) {
    if (await isCommunityGuestSanctioned(actor.guest.key, actor.guest.ipKey)) {
      return mobileError("FORBIDDEN", "이 비회원 ID 또는 접속 환경은 커뮤니티 이용이 제한되었습니다.", 403);
    }
    const rateError = await guestRateLimitError(actor.guest.ipKey, "comment");
    if (rateError) return mobileError("RATE_LIMITED", rateError, 429);
  }
  try {
    const created = await createComment({
      authorId: actor.auth?.user.id ?? null,
      content: validated.content,
      guest: actor.auth ? undefined : actor.guest,
      parentId,
      postId,
    });
    if (actor.auth) await recordLpEvent({ commentId: created.id, reason: "comment_created", userId: actor.auth.user.id });
    scheduleCommunityCommentNotifications({
      actor: actor.auth ? { userId: actor.auth.user.id } : { guestKey: actor.guest.key },
      actorName: actor.auth ? undefined : actor.guest.nickname,
      commentId: created.id,
      parentId,
      postId,
    });
    scheduleMobileCommunityModeration({ commentId: created.id, text: validated.content });
    const data: MobileCommunityCommentMutationDto = { id: created.id, message: "댓글 톡 붙여뒀어요." };
    return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" }, status: 201 });
  } catch {
    return mobileError("INTERNAL", "댓글을 등록하지 못했습니다.", 500);
  }
}
