import type { MobileCommunityActionDto, MobileCommunityCommentMutationDto } from "@/packages/contracts/src/mobile-v1";
import { deleteGuestComment, getCommentById, updateGuestComment } from "@/lib/data/community";
import { isCommunityGuestSanctioned } from "@/lib/data/community-guests";
import { isCommunityUserSanctioned } from "@/lib/data/community-users";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileCommunityActor, scheduleMobileCommunityModeration, validateMobileCommentInput } from "@/lib/mobile/community";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ commentId: string }> };

async function ownedComment(request: Request, commentId: string) {
  const actor = await getMobileCommunityActor(request).catch(() => null);
  const comment = await getCommentById(commentId);
  const owned = comment?.authorId
    ? comment.authorId === actor?.auth?.user.id
    : Boolean(comment?.guestKey && comment.guestKey === actor?.guest.key);
  return { actor, comment, owned };
}

export async function PATCH(request: Request, context: Context) {
  const { commentId } = await context.params;
  const { actor, comment, owned } = await ownedComment(request, commentId);
  if (!actor) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);
  if (!comment || !owned) return mobileError("FORBIDDEN", "댓글을 수정할 권한이 없습니다.", 403);
  if (actor.auth && await isCommunityUserSanctioned(actor.auth.user.id)) return mobileError("FORBIDDEN", "커뮤니티 이용이 영구 제한된 계정입니다.", 403);
  if (!actor.auth && await isCommunityGuestSanctioned(actor.guest.key, actor.guest.ipKey)) return mobileError("FORBIDDEN", "이 비회원 ID 또는 접속 환경은 커뮤니티 이용이 제한되었습니다.", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const validated = validateMobileCommentInput(body?.content);
  if (!validated.ok) return mobileError("BAD_REQUEST", validated.error, 400);
  await updateGuestComment(commentId, validated.content);
  scheduleMobileCommunityModeration({ commentId, text: validated.content });
  const data: MobileCommunityCommentMutationDto = { id: commentId, message: "댓글을 수정했습니다." };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request, context: Context) {
  const { commentId } = await context.params;
  const { actor, comment, owned } = await ownedComment(request, commentId);
  if (!actor) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);
  if (!comment || !owned) return mobileError("FORBIDDEN", "댓글을 삭제할 권한이 없습니다.", 403);
  await deleteGuestComment(commentId);
  const data: MobileCommunityActionDto = { message: "댓글을 삭제했습니다." };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
