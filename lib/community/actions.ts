"use server";

// 게시판 서버 액션.
// - 글/댓글은 비회원도 닉네임·비밀번호·서버 검증 IP로 작성할 수 있다.
// - 리액션/신고 등 계정 귀속 행동은 로그인을 유지한다.
// - LP는 로그인 작성자에게만 반영한다.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";

import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordLpEvent } from "@/lib/rank/record-lp";
import { scheduleCommunityCommentNotifications } from "@/lib/notifications/community";
import type { BoardScope } from "@/lib/community/boards";
import { getBoard } from "@/lib/community/boards";
import { screenCommunityText } from "@/lib/community/ai-moderation";
import { findProfanity, maskProfanity } from "@/lib/community/content-filter";
import { extractPlainText } from "@/lib/community/extract-thumbnail";
import {
  getGuestPostAttachmentError,
  getCommentMaxLengthForRequest,
  getCommunityPostTextLength,
  POST_SERIALIZED_MAX_LENGTH,
  POST_TEXT_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
} from "@/lib/community/limits";
import { AI_MODERATOR_NAME } from "@/lib/community/moderation-labels";
import { sendDiscordCommunityModerationAlert } from "@/lib/notify/discord";
import { isCommunityUserSanctioned } from "@/lib/data/community-users";
import { guestRateLimitError, isCommunityGuestSanctioned } from "@/lib/data/community-guests";
import {
  getExistingGuestKey,
  getGuestIdentity,
} from "@/lib/community/guest-identity";
import type {
  ActionResult,
  ReactionKind,
  ReactionState,
  ReactionTarget,
} from "@/lib/community/types";
import {
  applyAiFlag,
  blindTargetIfReported,
  createComment,
  createPost,
  deleteGuestComment,
  deletePost,
  createReport,
  getCommentById,
  getPostById,
  getUserReaction,
  getUserReactionsForComments,
  promotePostIfHot,
  setReaction,
  updatePost,
  updateGuestComment,
} from "@/lib/data/community";

const LOGIN_REQUIRED: ActionResult = {
  ok: false,
  error: "로그인이 필요합니다.",
  requiresLogin: true,
};

export async function getGuestNicknameAction(): Promise<
  { ok: true; nickname: string } | { ok: false; error: string }
> {
  try {
    const identity = await getGuestIdentity();
    return { ok: true, nickname: identity.nickname };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "비회원 닉네임을 발급하지 못했습니다.",
    };
  }
}

async function communitySanctionError(
  userId: string,
): Promise<{ ok: false; error: string } | null> {
  return (await isCommunityUserSanctioned(userId))
    ? { ok: false, error: "커뮤니티 이용이 영구 제한된 계정입니다." }
    : null;
}

/** 리액션 액션 결과. 성공 시 최종 stance(state)를 돌려줘 클라이언트 UI 동기화에 쓴다. */
export type ReactionActionResult =
  | { ok: true; state: ReactionState }
  | { ok: false; error: string; requiresLogin?: boolean };

/** 커뮤니티 피드 인덱스 경로(revalidate 용). 단일 피드라 말머리 구분 없이 인덱스만 갱신. */
function communityIndexPath(scope: BoardScope, teamSlug: string | undefined): string {
  return scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : `/community`;
}

function postPath(scope: BoardScope, teamSlug: string | undefined, postId: string): string {
  return scope === "team" && teamSlug
    ? `/fan/${teamSlug}/community/post/${postId}`
    : `/community/post/${postId}`;
}

async function requestCommentMaxLength(): Promise<number> {
  const requestHeaders = await headers();
  return getCommentMaxLengthForRequest(
    requestHeaders.get("user-agent"),
    requestHeaders.get("sec-ch-ua-mobile"),
  );
}

function postLengthError(title: string, content: string): ActionResult | null {
  if (title.length > POST_TITLE_MAX_LENGTH) {
    return { ok: false, error: `제목은 ${POST_TITLE_MAX_LENGTH}자까지 입력할 수 있습니다.` };
  }
  if (content.length > POST_SERIALIZED_MAX_LENGTH) {
    return { ok: false, error: "본문의 서식 또는 첨부 정보가 너무 큽니다." };
  }
  if (getCommunityPostTextLength(content) > POST_TEXT_MAX_LENGTH) {
    return { ok: false, error: `본문은 ${POST_TEXT_MAX_LENGTH.toLocaleString("ko-KR")}자까지 입력할 수 있습니다.` };
  }
  return null;
}

/**
 * 금칙어(쌍욕) 동기 검사. 걸리면 에러 메시지를, 통과하면 null 을 반환한다.
 * 글 본문은 에디터 JSON 이므로 평문을 뽑아 제목과 함께 검사한다.
 */
function profanityError(texts: { title?: string; editorContent?: string; plainText?: string }): string | null {
  const combined = [
    texts.title ?? "",
    texts.editorContent ? extractPlainText(texts.editorContent, 1_000_000) : "",
    texts.plainText ?? "",
  ].join("\n");

  const matched = findProfanity(combined);
  if (!matched) return null;
  return `금칙어(${maskProfanity(matched)})가 포함되어 등록할 수 없습니다. 표현을 수정해 주세요.`;
}

/**
 * 디스코드 모더레이션 알림(웹훅 미설정 시 건너뜀). 실패해도 흐름을 막지 않는다.
 * 두 명 운영 체제 전제: 어드민 페이지를 상시 확인하는 대신, 자동 블라인드가
 * 발생한 순간에만 디스코드로 알리고 필요할 때 들어와 처리한다.
 */
async function notifyDiscordModeration(event: {
  kind: "ai_blind" | "report_blind";
  targetType: "post" | "comment";
  summary: string;
  reason?: string | null;
  reportCount?: number | null;
  scope: BoardScope;
  teamSlug?: string;
  /** 대상이 속한 글 id(링크용). */
  pagePostId: string;
}): Promise<void> {
  const webhookUrl = process.env.DISCORD_COMMUNITY_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await sendDiscordCommunityModerationAlert(
      webhookUrl,
      {
        kind: event.kind,
        targetType: event.targetType,
        summary: event.summary,
        reason: event.reason,
        reportCount: event.reportCount,
        postPath: postPath(event.scope, event.teamSlug, event.pagePostId),
        botName: event.kind === "ai_blind" ? AI_MODERATOR_NAME : "신고 알림",
      },
      process.env.NEXT_PUBLIC_SITE_URL,
    );
  } catch (error) {
    console.warn("[discord] 모더레이션 알림 실패", error);
  }
}

/**
 * AI 검수 예약. after() 로 응답 전송 이후에 실행되므로 글쓰기 지연이 없다.
 * 위반 판정이면 블라인드 + 신고함(AI) 등록 후 목록/상세를 갱신한다.
 * 검수 실패는 조용히 무시(fail-open) — 최종 안전망은 신고 누적 블라인드.
 */
function scheduleAiModeration(params: {
  postId?: string;
  commentId?: string;
  scope: BoardScope;
  teamSlug?: string;
  /** revalidate 대상 글 id(댓글이면 소속 글 id). */
  pagePostId: string;
  title?: string;
  text: string;
}): void {
  after(async () => {
    try {
      const verdict = await screenCommunityText({ title: params.title, text: params.text });
      if (!verdict.flagged) return;

      const newlyFlagged = await applyAiFlag({
        postId: params.postId ?? null,
        commentId: params.commentId ?? null,
        category: verdict.category,
        detail: verdict.detail,
      });

      if (newlyFlagged) {
        await notifyDiscordModeration({
          kind: "ai_blind",
          targetType: params.postId ? "post" : "comment",
          summary: params.title ?? params.text.replace(/\s+/g, " ").slice(0, 80),
          reason: verdict.detail ? `${verdict.category} — ${verdict.detail}` : verdict.category,
          scope: params.scope,
          teamSlug: params.teamSlug,
          pagePostId: params.pagePostId,
        });
      }

      try {
        revalidatePath(communityIndexPath(params.scope, params.teamSlug));
        revalidatePath(postPath(params.scope, params.teamSlug, params.pagePostId));
      } catch {
        // 응답 이후 문맥에서 revalidate 가 거부되더라도 블라인드는 이미 DB에 반영됐다.
      }
    } catch (error) {
      console.warn("[ai-moderation] 백그라운드 검수 실패", error);
    }
  });
}

/** 글 작성. */
export async function createPostAction(input: {
  scope: BoardScope;
  boardType: string;
  teamId?: string | null;
  teamSlug?: string;
  title: string;
  content: string;
  isNotice?: boolean;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user) {
    const sanction = await communitySanctionError(user.id);
    if (sanction) return sanction;
  }

  const board = getBoard(input.scope, input.boardType);
  if (!board) return { ok: false, error: "존재하지 않는 게시판입니다." };

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) return { ok: false, error: "제목을 입력하세요." };
  if (!content) return { ok: false, error: "내용을 입력하세요." };
  const lengthError = postLengthError(title, content);
  if (lengthError) return lengthError;

  const profanity = profanityError({ title, editorContent: content });
  if (profanity) return { ok: false, error: profanity };
  if (!user) {
    const attachmentError = getGuestPostAttachmentError(content);
    if (attachmentError) return { ok: false, error: attachmentError };
  }

  let guest: { nickname: string; key: string; ipKey: string; ipLabel: string } | undefined;
  if (!user) {
    try {
      const identity = await getGuestIdentity();
      if (await isCommunityGuestSanctioned(identity.key, identity.ipKey)) {
        return { ok: false, error: "이 비회원 ID 또는 접속 환경은 커뮤니티 이용이 제한되었습니다." };
      }
      const rateError = await guestRateLimitError(identity.ipKey, "post");
      if (rateError) return { ok: false, error: rateError };
      guest = identity;
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "비회원 정보를 확인하지 못했습니다." };
    }
  }

  const { id } = await createPost({
    scope: input.scope,
    boardType: input.boardType,
    teamId: input.teamId,
    title,
    content,
    authorId: user?.id ?? null,
    guest,
    isNotice: Boolean(user && input.isNotice && (await isCurrentUserAdmin())),
  });

  if (user) await recordLpEvent({ userId: user.id, reason: "post_created", postId: id });

  scheduleAiModeration({
    postId: id,
    pagePostId: id,
    scope: input.scope,
    teamSlug: input.teamSlug,
    title,
    text: extractPlainText(content, 1_000_000),
  });

  revalidatePath(communityIndexPath(input.scope, input.teamSlug));
  return { ok: true, message: "글 발사 완료. 게시판에 착지했어요." };
}

export async function updatePostAction(input: {
  postId: string;
  scope: BoardScope;
  boardType: string;
  teamSlug?: string;
  title: string;
  content: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  const post = await getPostById(input.postId);
  const isRegisteredOwner = Boolean(user && post?.authorId === user.id);
  const isGuestOwner = Boolean(
    post?.guestKey
    && !post.authorId
    && post.guestKey === await getExistingGuestKey(),
  );
  if (!post || (!isRegisteredOwner && !isGuestOwner) || post.siteScope !== input.scope) {
    return { ok: false, error: "게시글을 수정할 권한이 없습니다." };
  }
  if (user && isRegisteredOwner) {
    const sanction = await communitySanctionError(user.id);
    if (sanction) return sanction;
  }
  if (isGuestOwner) {
    const identity = await getGuestIdentity();
    if (await isCommunityGuestSanctioned(identity.key, identity.ipKey)) {
      return { ok: false, error: "이 비회원 ID 또는 접속 환경은 커뮤니티 이용이 제한되었습니다." };
    }
  }
  if (!getBoard(input.scope, input.boardType)) return { ok: false, error: "존재하지 않는 게시판입니다." };

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) return { ok: false, error: "제목을 입력하세요." };
  if (!content) return { ok: false, error: "내용을 입력하세요." };
  const lengthError = postLengthError(title, content);
  if (lengthError) return lengthError;

  const profanity = profanityError({ title, editorContent: content });
  if (profanity) return { ok: false, error: profanity };
  if (isGuestOwner) {
    const attachmentError = getGuestPostAttachmentError(content);
    if (attachmentError) return { ok: false, error: attachmentError };
  }

  await updatePost({ postId: input.postId, boardType: input.boardType, title, content });

  // 수정 시에도 재검수 — "정상 글로 등록 후 광고로 수정" 우회를 막는다.
  scheduleAiModeration({
    postId: input.postId,
    pagePostId: input.postId,
    scope: input.scope,
    teamSlug: input.teamSlug,
    title,
    text: extractPlainText(content, 1_000_000),
  });

  revalidatePath(postPath(input.scope, input.teamSlug, input.postId));
  revalidatePath(communityIndexPath(input.scope, input.teamSlug));
  return { ok: true, message: "수정 완료. 문장 결 살짝 정돈했어요." };
}

export async function deletePostAction(input: {
  postId: string;
  scope: BoardScope;
  teamSlug?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return LOGIN_REQUIRED;

  const post = await getPostById(input.postId);
  if (!post || post.authorId !== user.id || post.siteScope !== input.scope) {
    return { ok: false, error: "게시글을 삭제할 권한이 없습니다." };
  }

  await deletePost(input.postId);
  revalidatePath(communityIndexPath(input.scope, input.teamSlug));
  return { ok: true, message: "게시글을 조용히 치웠어요." };
}

/** 댓글 작성. */
export async function createCommentAction(input: {
  postId: string;
  content: string;
  parentId?: string | null;
  scope: BoardScope;
  teamSlug?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user) {
    const sanction = await communitySanctionError(user.id);
    if (sanction) return sanction;
  }

  const content = input.content.trim();
  if (!content) return { ok: false, error: "댓글 내용을 입력하세요." };
  const maxLength = await requestCommentMaxLength();
  if (content.length > maxLength) {
    return { ok: false, error: `댓글은 ${maxLength}자까지 입력할 수 있습니다.` };
  }

  const profanity = profanityError({ plainText: content });
  if (profanity) return { ok: false, error: profanity };

  if (input.parentId) {
    const parent = await getCommentById(input.parentId);
    if (!parent || parent.postId !== input.postId) {
      return { ok: false, error: "답글을 작성할 댓글을 찾을 수 없습니다." };
    }
  }

  let guest: { nickname: string; key: string; ipKey: string; ipLabel: string } | undefined;
  if (!user) {
    try {
      const identity = await getGuestIdentity();
      if (await isCommunityGuestSanctioned(identity.key, identity.ipKey)) {
        return { ok: false, error: "이 비회원 ID 또는 접속 환경은 커뮤니티 이용이 제한되었습니다." };
      }
      const rateError = await guestRateLimitError(identity.ipKey, "comment");
      if (rateError) return { ok: false, error: rateError };
      guest = identity;
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "비회원 정보를 확인하지 못했습니다." };
    }
  }

  const { id } = await createComment({
    postId: input.postId,
    content,
    authorId: user?.id ?? null,
    guest,
    parentId: input.parentId ?? null,
  });

  if (user) await recordLpEvent({ userId: user.id, reason: "comment_created", commentId: id });

  scheduleCommunityCommentNotifications({
    actor: user ? { userId: user.id } : { guestKey: guest!.key },
    actorName: user?.nickname ?? guest?.nickname ?? "비회원",
    commentId: id,
    parentId: input.parentId ?? null,
    postId: input.postId,
  });

  scheduleAiModeration({
    commentId: id,
    pagePostId: input.postId,
    scope: input.scope,
    teamSlug: input.teamSlug,
    text: content,
  });

  revalidatePath(postPath(input.scope, input.teamSlug, input.postId));
  return { ok: true, message: "댓글 톡 붙여뒀어요." };
}

export async function deleteGuestPostAction(input: {
  postId: string;
  scope: BoardScope;
  teamSlug?: string;
}): Promise<ActionResult> {
  const post = await getPostById(input.postId);
  if (!post?.guestKey || post.siteScope !== input.scope) {
    return { ok: false, error: "비회원 게시글을 찾을 수 없습니다." };
  }
  try {
    if ((await getGuestIdentity()).key !== post.guestKey) {
      return { ok: false, error: "이 글을 작성한 브라우저에서만 삭제할 수 있습니다." };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "비회원 ID를 확인하지 못했습니다." };
  }
  await deletePost(input.postId);
  revalidatePath(communityIndexPath(input.scope, input.teamSlug));
  return { ok: true, message: "게시글을 삭제했습니다." };
}

export async function deleteGuestCommentAction(input: {
  commentId: string;
  postId: string;
  scope: BoardScope;
  teamSlug?: string;
}): Promise<ActionResult> {
  const comment = await getCommentById(input.commentId);
  if (!comment?.guestKey || comment.postId !== input.postId) {
    return { ok: false, error: "비회원 댓글을 찾을 수 없습니다." };
  }
  try {
    if ((await getGuestIdentity()).key !== comment.guestKey) {
      return { ok: false, error: "이 댓글을 작성한 브라우저에서만 삭제할 수 있습니다." };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "비회원 ID를 확인하지 못했습니다." };
  }
  await deleteGuestComment(input.commentId);
  revalidatePath(postPath(input.scope, input.teamSlug, input.postId));
  return { ok: true, message: "댓글을 삭제했습니다." };
}

export async function updateGuestCommentAction(input: {
  commentId: string;
  postId: string;
  content: string;
  scope: BoardScope;
  teamSlug?: string;
}): Promise<ActionResult> {
  const content = input.content.trim();
  if (!content) return { ok: false, error: "댓글 내용을 입력해주세요." };
  const maxLength = await requestCommentMaxLength();
  if (content.length > maxLength) {
    return { ok: false, error: `댓글은 ${maxLength}자까지 입력할 수 있습니다.` };
  }
  const profanity = profanityError({ plainText: content });
  if (profanity) return { ok: false, error: profanity };

  const comment = await getCommentById(input.commentId);
  const guestKey = await getExistingGuestKey();
  if (!comment?.guestKey || comment.postId !== input.postId || comment.guestKey !== guestKey) {
    return { ok: false, error: "이 댓글을 수정할 권한이 없습니다." };
  }

  const identity = await getGuestIdentity();
  if (await isCommunityGuestSanctioned(identity.key, identity.ipKey)) {
    return { ok: false, error: "이 비회원 ID 또는 접속 환경은 커뮤니티 이용이 제한되었습니다." };
  }

  await updateGuestComment(input.commentId, content);
  scheduleAiModeration({
    commentId: input.commentId,
    pagePostId: input.postId,
    scope: input.scope,
    teamSlug: input.teamSlug,
    text: content,
  });
  revalidatePath(postPath(input.scope, input.teamSlug, input.postId));
  return { ok: true, message: "댓글을 수정했습니다." };
}

/**
 * 리액션(명예/싫어요) 토글. 글·댓글 공용.
 * - 자기 글/댓글에도 누를 수 있다(제한 없음).
 * - 명예↔싫어요는 상호 배타(전환 시 이전 stance 자동 해제).
 * - 대상 작성자의 LP 를 stance 변화에 맞춰 반영한다.
 *   싫어요를 받으면(작성자 기준) LP 가 떨어진다(dishonor_received).
 */
export async function reactAction(input: {
  target: ReactionTarget;
  targetId: string;
  kind: ReactionKind;
  postId: string; // revalidate 용(댓글이면 소속 글 id).
  scope: BoardScope;
  teamSlug?: string;
}): Promise<ReactionActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다.", requiresLogin: true };
  const sanction = await communitySanctionError(user.id);
  if (sanction) return sanction;

  // 대상 작성자(LP 반영 대상) 확인.
  const authorId =
    input.target === "post"
      ? (await getPostById(input.targetId))?.authorId ?? null
      : (await getCommentById(input.targetId))?.authorId ?? null;

  const { before, after } = await setReaction({
    target: input.target,
    targetId: input.targetId,
    userId: user.id,
    kind: input.kind,
  });

  // 작성자 LP 반영. 명예↔싫어요 전환 시 취소+획득 두 이벤트가 함께 발생할 수 있다.
  if (authorId && before !== after) {
    const ref = input.target === "post"
      ? { postId: input.targetId }
      : { commentId: input.targetId };
    if (before === "honor") await recordLpEvent({ userId: authorId, reason: "honor_removed", ...ref });
    if (before === "dislike") await recordLpEvent({ userId: authorId, reason: "dishonor_removed", ...ref });
    if (after === "honor") await recordLpEvent({ userId: authorId, reason: "honor_received", ...ref });
    if (after === "dislike") await recordLpEvent({ userId: authorId, reason: "dishonor_received", ...ref });
  }

  // 인기글 승격 판정: 명예 - 싫어요가 스코프 컷 이상이면 hot_at 스냅샷(등재 후 유지).
  if (input.target === "post" && before !== after) {
    const promoted = await promotePostIfHot(input.targetId);
    if (promoted) {
      revalidatePath(communityIndexPath(input.scope, input.teamSlug));
    }
  }

  revalidatePath(postPath(input.scope, input.teamSlug, input.postId));
  return { ok: true, state: after };
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
  const sanction = await communitySanctionError(user.id);
  if (sanction) return sanction;

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

  // LP 차감은 접수 시점이 아니라 운영자가 제재를 확정한 시점에 반영한다(담합 신고 악용 방지).
  // 다만 서로 다른 이용자의 미처리 신고가 임계값에 도달하면 1차 방어로 자동 블라인드한다.
  const { newlyBlinded, reportCount } = await blindTargetIfReported({
    scope: input.scope,
    postId: input.postId,
  });
  if (newlyBlinded) {
    revalidatePath(communityIndexPath(input.scope, input.teamSlug));
    after(() =>
      notifyDiscordModeration({
        kind: "report_blind",
        targetType: "post",
        summary: post.title,
        reportCount,
        scope: input.scope,
        teamSlug: input.teamSlug,
        pagePostId: input.postId,
      }),
    );
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
  const sanction = await communitySanctionError(user.id);
  if (sanction) return sanction;

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

  // LP 차감은 운영자 제재 확정 시점에 반영. 신고 누적 시 자동 블라인드만 즉시 수행.
  const { newlyBlinded, reportCount } = await blindTargetIfReported({
    scope: input.scope,
    commentId: input.commentId,
  });
  if (newlyBlinded) {
    after(() =>
      notifyDiscordModeration({
        kind: "report_blind",
        targetType: "comment",
        summary: comment.content.replace(/\s+/g, " ").slice(0, 80),
        reportCount,
        scope: input.scope,
        teamSlug: input.teamSlug,
        pagePostId: input.postId,
      }),
    );
  }

  revalidatePath(postPath(input.scope, input.teamSlug, input.postId));
  return { ok: true, message: "리폿이 접수되었습니다." };
}

/** 현재 사용자의 글 stance(명예/싫어요/없음). UI 초기 상태. */
export async function getPostReactionState(postId: string): Promise<ReactionState> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getUserReaction({ target: "post", targetId: postId, userId: user.id });
}

/** 현재 사용자의 댓글별 stance 맵. UI 초기 상태. */
export async function getCommentReactionStates(
  commentIds: string[],
): Promise<Record<string, ReactionState>> {
  const user = await getCurrentUser();
  if (!user || commentIds.length === 0) return {};
  return getUserReactionsForComments(commentIds, user.id);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
