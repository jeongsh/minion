import type {
  MobileCommunityActionDto,
  MobileCommunityPostDetailDto,
  MobileCommunityPostMutationDto,
} from "@/packages/contracts/src/mobile-v1";
import { extractPlainText } from "@/lib/community/extract-thumbnail";
import { getGuestPostAttachmentError } from "@/lib/community/limits";
import {
  deletePost,
  getPostById,
  getPostByIdAndIncrementView,
  getPostComments,
  getUserReaction,
  getUserReactionsForComments,
  updatePost,
} from "@/lib/data/community";
import { isCommunityGuestSanctioned } from "@/lib/data/community-guests";
import { isCommunityUserSanctioned } from "@/lib/data/community-users";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import {
  getMobileCommunityActor,
  getMobileBlockedCommunityAuthors,
  isMobileCommunityAuthorBlocked,
  parseTiptapDocument,
  scheduleMobileCommunityModeration,
  toMobileCommunityComment,
  toMobileCommunityPost,
  validateMobilePostInput,
} from "@/lib/mobile/community";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ postId: string }> };

export async function GET(request: Request, context: Context) {
  const { postId } = await context.params;
  const actor = await getMobileCommunityActor(request).catch(() => null);
  if (!actor) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);
  const [post, comments] = await Promise.all([
    getPostByIdAndIncrementView(postId),
    getPostComments(postId),
  ]);
  if (!post) return mobileError("NOT_FOUND", "게시글을 찾을 수 없습니다.", 404);
  const teamSlug = new URL(request.url).searchParams.get("team")?.trim();
  if (teamSlug) {
    const team = await getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug));
    if (!team || post.siteScope !== "team" || post.teamId !== team.id) {
      return mobileError("NOT_FOUND", "게시글을 찾을 수 없습니다.", 404);
    }
  }
  const blocked = await getMobileBlockedCommunityAuthors(actor.auth?.user.id);
  if (isMobileCommunityAuthorBlocked(post, blocked)) return mobileError("NOT_FOUND", "게시글을 찾을 수 없습니다.", 404);
  const visibleComments = comments.filter((comment) => !isMobileCommunityAuthorBlocked(comment, blocked));

  const reactionActor = actor.auth ? { userId: actor.auth.user.id } : { guestKey: actor.guest.key };
  const [reaction, commentReactions]: ["honor" | "dislike" | null, Record<string, "honor" | "dislike" | null>] = await Promise.all([
    getUserReaction({ target: "post", targetId: postId, ...reactionActor }),
    getUserReactionsForComments(visibleComments.map((comment) => comment.id), reactionActor),
  ]);
  const canManage = post.authorId
    ? post.authorId === actor.auth?.user.id
    : Boolean(post.guestKey && post.guestKey === actor.guest.key);
  const data: MobileCommunityPostDetailDto = {
    ...toMobileCommunityPost(post),
    comments: visibleComments.map((comment) => toMobileCommunityComment(comment, actor, commentReactions[comment.id] ?? null)),
    content: parseTiptapDocument(post.content),
    permissions: {
      canBlock: Boolean(actor.auth && !canManage),
      canDelete: canManage,
      canEdit: canManage,
      canReact: true,
      canReport: !canManage,
    },
    reaction,
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const { postId } = await context.params;
  const actor = await getMobileCommunityActor(request).catch(() => null);
  if (!actor) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);
  const post = await getPostById(postId);
  const canManage = post?.authorId
    ? post.authorId === actor.auth?.user.id
    : Boolean(post?.guestKey && post.guestKey === actor.guest.key);
  if (!post || !canManage) return mobileError("FORBIDDEN", "게시글을 수정할 권한이 없습니다.", 403);
  if (actor.auth && await isCommunityUserSanctioned(actor.auth.user.id)) {
    return mobileError("FORBIDDEN", "커뮤니티 이용이 영구 제한된 계정입니다.", 403);
  }
  if (!actor.auth && await isCommunityGuestSanctioned(actor.guest.key, actor.guest.ipKey)) {
    return mobileError("FORBIDDEN", "이 비회원 ID 또는 접속 환경은 커뮤니티 이용이 제한되었습니다.", 403);
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const boardType = typeof body?.boardType === "string" ? body.boardType : "";
  const validated = validateMobilePostInput({ boardType, content: body?.content, scope: post.siteScope, title: body?.title });
  if (!validated.ok) return mobileError("BAD_REQUEST", validated.error, 400);
  if (!actor.auth) {
    const attachmentError = getGuestPostAttachmentError(validated.content);
    if (attachmentError) return mobileError("BAD_REQUEST", attachmentError, 400);
  }
  await updatePost({ boardType, content: validated.content, postId, title: validated.title });
  scheduleMobileCommunityModeration({ postId, text: extractPlainText(validated.content, 1_000_000), title: validated.title });
  const data: MobileCommunityPostMutationDto = { id: postId, message: "수정 완료. 문장 결 살짝 정돈했어요." };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request, context: Context) {
  const { postId } = await context.params;
  const actor = await getMobileCommunityActor(request).catch(() => null);
  if (!actor) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);
  const post = await getPostById(postId);
  const canManage = post?.authorId
    ? post.authorId === actor.auth?.user.id
    : Boolean(post?.guestKey && post.guestKey === actor.guest.key);
  if (!post || !canManage) return mobileError("FORBIDDEN", "게시글을 삭제할 권한이 없습니다.", 403);
  await deletePost(postId);
  const data: MobileCommunityActionDto = { message: "게시글을 삭제했습니다." };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
