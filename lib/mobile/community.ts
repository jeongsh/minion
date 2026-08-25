import { after } from "next/server";

import type {
  MobileCommunityAuthor,
  MobileCommunityComment,
  MobileCommunityPostSummary,
  TiptapDocument,
} from "@/packages/contracts/src/mobile-v1";
import { screenCommunityText } from "@/lib/community/ai-moderation";
import { getBoard, type BoardScope } from "@/lib/community/boards";
import { findProfanity, maskProfanity } from "@/lib/community/content-filter";
import { extractPlainText } from "@/lib/community/extract-thumbnail";
import { getMobileGuestIdentity, type GuestIdentity } from "@/lib/community/guest-identity";
import {
  COMMENT_MOBILE_MAX_LENGTH,
  getCommunityPostTextLength,
  POST_SERIALIZED_MAX_LENGTH,
  POST_TEXT_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
} from "@/lib/community/limits";
import { applyAiFlag } from "@/lib/data/community";
import type { CommunityCommentItem, CommunityPostDetail } from "@/lib/community/types";
import { getMobileAuth, type MobileAuthContext } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MobileCommunityActor = {
  auth: MobileAuthContext | null;
  guest: GuestIdentity;
};

export async function getMobileCommunityActor(request: Request): Promise<MobileCommunityActor> {
  return { auth: await getMobileAuth(request), guest: getMobileGuestIdentity(request) };
}

export type MobileBlockedCommunityAuthors = { users: Set<string>; guests: Set<string> };

export async function getMobileBlockedCommunityAuthors(userId?: string | null): Promise<MobileBlockedCommunityAuthors> {
  if (!userId) return { users: new Set(), guests: new Set() };
  const admin = createSupabaseAdminClient();
  const [users, guests] = await Promise.all([
    admin.from("community_user_blocks").select("blocked_id").eq("blocker_id", userId),
    admin.from("community_guest_blocks").select("guest_key").eq("blocker_id", userId),
  ]);
  if (users.error) throw users.error;
  if (guests.error) throw guests.error;
  return {
    users: new Set((users.data ?? []).map((row) => row.blocked_id)),
    guests: new Set((guests.data ?? []).map((row) => row.guest_key)),
  };
}

export function isMobileCommunityAuthorBlocked(
  item: { authorId: string | null; guestKey?: string | null },
  blocked: MobileBlockedCommunityAuthors,
) {
  return Boolean(
    (item.authorId && blocked.users.has(item.authorId))
    || (item.guestKey && blocked.guests.has(item.guestKey)),
  );
}

export function parseTiptapDocument(content: string): TiptapDocument {
  try {
    const parsed = JSON.parse(content) as TiptapDocument;
    if (parsed?.type === "doc") return parsed;
  } catch {
    // Legacy plain text is normalized below.
  }
  return {
    type: "doc",
    content: content
      .split(/\r?\n/)
      .map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : undefined })),
  };
}

function toMobileAuthor(item: Pick<CommunityPostDetail, "authorId" | "authorName" | "authorImageUrl" | "authorTier" | "guestIpLabel"> | Pick<CommunityCommentItem, "authorId" | "authorName" | "authorImageUrl" | "authorTier" | "guestIpLabel">): MobileCommunityAuthor {
  return {
    guestIpLabel: item.guestIpLabel,
    id: item.authorId,
    nickname: item.authorName,
    profileImage: item.authorImageUrl ? { url: item.authorImageUrl } : null,
    tier: item.authorTier,
  };
}

export function toMobileCommunityPost(post: CommunityPostDetail): MobileCommunityPostSummary {
  return {
    author: toMobileAuthor(post),
    blindedSource: post.blindedSource,
    boardType: post.boardType,
    commentCount: post.commentCount,
    createdAt: post.createdAt,
    dislikeCount: post.dislikeCount,
    excerpt: post.excerpt,
    id: post.id,
    isBlinded: Boolean(post.blindedAt),
    isHot: Boolean(post.hotAt),
    isNotice: post.isNotice,
    likeCount: post.likeCount,
    scope: post.siteScope,
    teamId: post.teamId,
    thumbnail: post.thumbnailUrl ? { url: post.thumbnailUrl } : null,
    title: post.title,
    viewCount: post.viewCount,
  };
}

export function toMobileCommunityComment(
  comment: CommunityCommentItem,
  actor: MobileCommunityActor,
  reaction: "honor" | "dislike" | null,
): MobileCommunityComment {
  const canManage = comment.authorId
    ? comment.authorId === actor.auth?.user.id
    : Boolean(comment.guestKey && comment.guestKey === actor.guest.key);
  return {
    author: toMobileAuthor(comment),
    blindedSource: comment.blindedSource,
    content: comment.content,
    createdAt: comment.createdAt,
    dislikeCount: comment.dislikeCount,
    id: comment.id,
    isBlinded: Boolean(comment.blindedAt),
    isDeleted: Boolean(comment.deletedAt),
    likeCount: comment.likeCount,
    parentId: comment.parentId,
    permissions: { canDelete: canManage, canEdit: canManage, canReport: !canManage },
    postId: comment.postId,
    reaction,
  };
}

function containsRenderableNode(content: string) {
  try {
    const doc = JSON.parse(content) as { type?: string; content?: unknown[] };
    let found = false;
    const walk = (value: unknown) => {
      if (found || !value || typeof value !== "object") return;
      const node = value as { type?: string; text?: string; content?: unknown[] };
      if (node.type === "text" && node.text?.trim()) found = true;
      if (["image", "imageResize", "youtube", "embed", "poll"].includes(node.type ?? "")) found = true;
      node.content?.forEach(walk);
    };
    walk(doc);
    return found;
  } catch {
    return content.trim().length > 0;
  }
}

function profanityMessage(text: string) {
  const matched = findProfanity(text);
  return matched ? `금칙어(${maskProfanity(matched)})가 포함되어 등록할 수 없습니다. 표현을 수정해 주세요.` : null;
}

export function validateMobilePostInput(input: {
  scope: BoardScope;
  boardType: string;
  title: unknown;
  content: unknown;
}) {
  if (!getBoard(input.scope, input.boardType)) return { error: "존재하지 않는 게시판입니다.", ok: false } as const;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (!title) return { error: "제목을 입력하세요.", ok: false } as const;
  if (!content || !containsRenderableNode(content)) return { error: "내용을 입력하세요.", ok: false } as const;
  if (title.length > POST_TITLE_MAX_LENGTH) return { error: `제목은 ${POST_TITLE_MAX_LENGTH}자까지 입력할 수 있습니다.`, ok: false } as const;
  if (content.length > POST_SERIALIZED_MAX_LENGTH) return { error: "본문의 서식 또는 첨부 정보가 너무 큽니다.", ok: false } as const;
  if (getCommunityPostTextLength(content) > POST_TEXT_MAX_LENGTH) return { error: `본문은 ${POST_TEXT_MAX_LENGTH.toLocaleString("ko-KR")}자까지 입력할 수 있습니다.`, ok: false } as const;
  const profanity = profanityMessage(`${title}\n${extractPlainText(content, 1_000_000)}`);
  if (profanity) return { error: profanity, ok: false } as const;
  return { content, ok: true, title } as const;
}

export function validateMobileCommentInput(content: unknown) {
  const value = typeof content === "string" ? content.trim() : "";
  if (!value) return { error: "댓글 내용을 입력하세요.", ok: false } as const;
  if (value.length > COMMENT_MOBILE_MAX_LENGTH) return { error: `댓글은 ${COMMENT_MOBILE_MAX_LENGTH}자까지 입력할 수 있습니다.`, ok: false } as const;
  const profanity = profanityMessage(value);
  return profanity ? ({ error: profanity, ok: false } as const) : ({ content: value, ok: true } as const);
}

export function scheduleMobileCommunityModeration(input: {
  postId?: string;
  commentId?: string;
  title?: string;
  text: string;
}) {
  after(async () => {
    const verdict = await screenCommunityText({ title: input.title, text: input.text });
    if (verdict.flagged) {
      await applyAiFlag({
        category: verdict.category,
        commentId: input.commentId,
        detail: verdict.detail,
        postId: input.postId,
      });
    }
  });
}
