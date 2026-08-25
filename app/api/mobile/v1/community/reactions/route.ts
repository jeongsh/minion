import type { MobileCommunityReactionDto } from "@/packages/contracts/src/mobile-v1";
import { getCommentById, getPostById, promotePostIfHot, setReaction } from "@/lib/data/community";
import { isCommunityUserSanctioned } from "@/lib/data/community-users";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";
import { recordLpEvent } from "@/lib/rank/record-lp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  if (await isCommunityUserSanctioned(auth.user.id)) return mobileError("FORBIDDEN", "커뮤니티 이용이 영구 제한된 계정입니다.", 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const target = body?.target === "comment" ? "comment" : body?.target === "post" ? "post" : null;
  const kind = body?.kind === "honor" ? "honor" : body?.kind === "dislike" ? "dislike" : null;
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  if (!target || !kind || !targetId) return mobileError("BAD_REQUEST", "반응 대상을 확인해 주세요.", 400);
  const item = target === "post" ? await getPostById(targetId) : await getCommentById(targetId);
  if (!item) return mobileError("NOT_FOUND", "반응 대상을 찾을 수 없습니다.", 404);

  try {
    const changed = await setReaction({ kind, target, targetId, userId: auth.user.id });
    const authorId = item.authorId;
    if (authorId && changed.before !== changed.after) {
      const ref = target === "post" ? { postId: targetId } : { commentId: targetId };
      if (changed.before === "honor") await recordLpEvent({ reason: "honor_removed", userId: authorId, ...ref });
      if (changed.before === "dislike") await recordLpEvent({ reason: "dishonor_removed", userId: authorId, ...ref });
      if (changed.after === "honor") await recordLpEvent({ reason: "honor_received", userId: authorId, ...ref });
      if (changed.after === "dislike") await recordLpEvent({ reason: "dishonor_received", userId: authorId, ...ref });
    }
    if (target === "post" && changed.before !== changed.after) await promotePostIfHot(targetId);
    const refreshed = target === "post" ? await getPostById(targetId) : await getCommentById(targetId);
    const data: MobileCommunityReactionDto = {
      dislikeCount: refreshed?.dislikeCount ?? 0,
      honorCount: refreshed?.likeCount ?? 0,
      state: changed.after,
    };
    return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return mobileError("CONFLICT", "반응을 처리하지 못했습니다.", 409);
  }
}
