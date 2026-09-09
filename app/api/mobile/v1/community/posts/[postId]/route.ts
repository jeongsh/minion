import { revalidatePath, revalidateTag } from "next/cache";

import type {
  MobileCommunityActionDto,
  MobileCommunityPostDetailDto,
  MobileCommunityPostMutationDto,
} from "@/packages/contracts/src/mobile-v1";
import { extractPlainText } from "@/lib/community/extract-thumbnail";
import { selectBestComments } from "@/lib/community/best-comments";
import { getGuestPostAttachmentError } from "@/lib/community/limits";
import { getIpKeyFromHeaders, getMobileGuestIdentity } from "@/lib/community/guest-identity";
import {
  deletePost,
  getPostById,
  getPostByIdAndIncrementView,
  getPostComments,
  getUserReaction,
  getUserReactionsForComments,
  updatePost,
} from "@/lib/data/community";
import { HOME_PUBLIC_DATA_TAG } from "@/lib/data/home-cache";
import { isCommunityGuestSanctioned } from "@/lib/data/community-guests";
import { isCommunityUserSanctioned } from "@/lib/data/community-users";
import { getTeamByFanSiteHost, getTeamById, getTeamBySlug } from "@/lib/data/lck";
import { getUserMiniconPacks } from "@/lib/data/minicons";
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

async function revalidateCommunityHome(teamId?: string | null) {
  revalidatePath("/");
  if (teamId) {
    const team = await getTeamById(teamId);
    if (team) revalidatePath(`/fan/${team.fanSiteHost || team.slug}`);
  }
  revalidateTag(HOME_PUBLIC_DATA_TAG, "max");
}

type Context = { params: Promise<{ postId: string }> };

export async function GET(request: Request, context: Context) {
  const { postId } = await context.params;
  try { getMobileGuestIdentity(request); }
  catch { return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400); }
  const actorPromise = getMobileCommunityActor(request).catch(() => null);
  const commentsPromise = getPostComments(postId);
  const teamSlug = new URL(request.url).searchParams.get("team")?.trim();
  const [actor, post, comments, team, viewerData, commentReactions] = await Promise.all([
    actorPromise,
    getPostByIdAndIncrementView(postId, getIpKeyFromHeaders(request.headers)),
    commentsPromise,
    teamSlug ? getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug)) : null,
    actorPromise.then((actor) => actor ? Promise.all([
      getMobileBlockedCommunityAuthors(actor.auth?.user.id),
      getUserReaction({ target: "post", targetId: postId, ...(actor.auth ? { userId: actor.auth.user.id } : { guestKey: actor.guest.key }) }),
      getUserMiniconPacks(actor.auth?.user.id),
    ]) : null),
    Promise.all([actorPromise, commentsPromise]).then(([actor, comments]) => actor
      ? getUserReactionsForComments(comments.map((comment) => comment.id), actor.auth ? { userId: actor.auth.user.id } : { guestKey: actor.guest.key })
      : {} as Record<string, "honor" | "dislike" | null>),
  ]);
  if (!actor || !viewerData) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);
  if (!post) return mobileError("NOT_FOUND", "게시글을 찾을 수 없습니다.", 404);
  if (teamSlug) {
    if (!team || post.siteScope !== "team" || post.teamId !== team.id) {
      return mobileError("NOT_FOUND", "게시글을 찾을 수 없습니다.", 404);
    }
  }
  const [blocked, reaction, miniconPacks] = viewerData;
  if (isMobileCommunityAuthorBlocked(post, blocked)) return mobileError("NOT_FOUND", "게시글을 찾을 수 없습니다.", 404);
  const visibleComments = comments.filter((comment) => !isMobileCommunityAuthorBlocked(comment, blocked));
  const bestCommentIds = new Set(selectBestComments(visibleComments).map((comment) => comment.id));

  const canManage = post.authorId
    ? post.authorId === actor.auth?.user.id
    : Boolean(post.guestKey && post.guestKey === actor.guest.key);
  const data: MobileCommunityPostDetailDto = {
    ...toMobileCommunityPost(post),
    comments: visibleComments.map((comment) => toMobileCommunityComment(
      comment,
      actor,
      commentReactions[comment.id] ?? null,
      bestCommentIds.has(comment.id),
    )),
    content: parseTiptapDocument(post.content),
    miniconPacks,
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
  await revalidateCommunityHome(post.teamId);
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
  await revalidateCommunityHome(post.teamId);
  const data: MobileCommunityActionDto = { message: "게시글을 삭제했습니다." };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
