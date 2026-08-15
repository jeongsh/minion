"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { BlindedContent } from "@/components/community/blinded-content";
import { AuthorMenu } from "@/components/community/author-menu";
import { CommentForm } from "@/components/community/comment-form";
import { formatRelativeOrDate } from "@/components/community/format";
import { ReactionButtons } from "@/components/community/reaction-buttons";
import { ReportButton } from "@/components/community/report-button";
import { useToast } from "@/components/ui/toast";
import { deleteGuestCommentAction, updateGuestCommentAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";
import { blindLabel } from "@/lib/community/moderation-labels";
import type { CommunityCommentItem, ReactionState } from "@/lib/community/types";
import { useCommentMaxLength } from "@/components/community/use-comment-max-length";

export function CommentList({ comments, commentReactions, scope, teamSlug, viewerId, currentGuestKey }: { comments: CommunityCommentItem[]; commentReactions: Record<string, ReactionState>; scope: BoardScope; teamSlug?: string; viewerId?: string | null; currentGuestKey?: string | null }) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  const maxLength = useCommentMaxLength();
  const roots = comments.filter((comment) => !comment.parentId);
  const repliesByParent = new Map<string, CommunityCommentItem[]>();
  comments.filter((comment) => comment.parentId).forEach((comment) => {
    const replies = repliesByParent.get(comment.parentId!) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parentId!, replies);
  });

  const removeGuestComment = (comment: CommunityCommentItem) => {
    if (!window.confirm("이 댓글을 삭제할까요?")) return;
    startTransition(async () => {
      const result = await deleteGuestCommentAction({
        commentId: comment.id,
        postId: comment.postId,
        scope,
        teamSlug,
      });
      showToast({
        title: result.ok ? "댓글 삭제 완료" : "삭제 실패",
        description: result.ok ? result.message : result.error,
        tone: result.ok ? "success" : "error",
      });
      if (result.ok) router.refresh();
    });
  };

  const guestDeleteButton = (comment: CommunityCommentItem) => comment.guestKey && comment.guestKey === currentGuestKey ? (
    <button type="button" disabled={pending} onClick={() => removeGuestComment(comment)} className="text-[13px] font-semibold text-[var(--ui-muted)] hover:text-red-500 disabled:opacity-50">삭제</button>
  ) : null;

  const beginGuestEdit = (comment: CommunityCommentItem) => {
    setEditingId(comment.id);
    setEditingContent(comment.content.slice(0, maxLength));
    setReplyTo(null);
  };

  const saveGuestEdit = (comment: CommunityCommentItem) => {
    startTransition(async () => {
      const result = await updateGuestCommentAction({
        commentId: comment.id,
        postId: comment.postId,
        content: editingContent,
        scope,
        teamSlug,
      });
      showToast({
        title: result.ok ? "댓글 수정 완료" : "수정 실패",
        description: result.ok ? result.message : result.error,
        tone: result.ok ? "success" : "error",
      });
      if (result.ok) {
        setEditingId(null);
        setEditingContent("");
        router.refresh();
      }
    });
  };

  const guestEditButton = (comment: CommunityCommentItem) => comment.guestKey && comment.guestKey === currentGuestKey ? (
    <button type="button" disabled={pending} onClick={() => beginGuestEdit(comment)} className="text-[13px] font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-ink)] disabled:opacity-50">수정</button>
  ) : null;

  if (comments.length === 0) return null;

  // 삭제된 댓글: 답글 유지를 위한 자리표시만 남긴다(본문은 서버에서 이미 비워짐).
  const deletedItem = (comment: CommunityCommentItem) => (
    <div key={comment.id} className="py-3.5">
      <p className="text-sm text-[var(--ui-muted)]">삭제된 댓글입니다.</p>
    </div>
  );

  const item = (comment: CommunityCommentItem, reply = false) => (
    <div key={comment.id} className={`min-w-0 ${reply ? "relative ml-3 border-t border-[var(--ui-border)] py-3 pl-3 before:absolute before:left-0 before:top-4 before:h-2.5 before:w-2.5 before:border-b before:border-l before:border-[var(--ui-border)] sm:ml-8 sm:pl-4" : "py-3.5"}`}>
      <div className="flex min-w-0 gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <AuthorMenu
                authorId={comment.authorId}
                authorName={comment.authorName}
                authorImageUrl={comment.authorImageUrl}
                authorTier={comment.authorTier}
                guestKey={comment.guestKey}
                viewerId={viewerId}
                variant="comment"
                evidencePostId={comment.postId}
                evidenceCommentId={comment.id}
                scope={scope}
                teamSlug={teamSlug}
              />
              <span className="shrink-0 text-[13px] text-[var(--ui-muted)]">{formatRelativeOrDate(comment.createdAt)}</span>
            </div>
            <div className="-my-1">
              <ReactionButtons target="comment" targetId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} initialState={commentReactions[comment.id] ?? null} initialHonorCount={comment.likeCount} initialDislikeCount={comment.dislikeCount} size="sm" />
            </div>
          </div>
          {editingId === comment.id ? (
            <div className="mt-2 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3">
              <textarea
                value={editingContent}
                onChange={(event) => setEditingContent(event.target.value)}
                rows={4}
                maxLength={maxLength}
                className="block w-full resize-none bg-transparent text-base leading-7 text-[var(--ui-text)] outline-none"
                aria-label="댓글 수정"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <span className="mr-auto text-[13px] tabular-nums text-[var(--ui-muted)]">{editingContent.length.toLocaleString("ko-KR")}/{maxLength.toLocaleString("ko-KR")}자</span>
                <button type="button" disabled={pending} onClick={() => setEditingId(null)} className="h-8 rounded-[var(--ui-control-radius)] px-3 text-[13px] font-semibold text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]">취소</button>
                <button type="button" disabled={pending || !editingContent.trim() || editingContent.length > maxLength} onClick={() => saveGuestEdit(comment)} className="h-8 rounded-[var(--ui-control-radius)] bg-[var(--ui-ink)] px-3 text-[13px] font-semibold text-[var(--ui-surface)] disabled:opacity-50">{pending ? "저장 중" : "저장"}</button>
              </div>
            </div>
          ) : comment.blindedAt ? (
            <BlindedContent compact label={blindLabel(comment.blindedSource, "comment")} source={comment.blindedSource}>
              <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-[1.65] text-[var(--ui-text)] [overflow-wrap:anywhere] md:text-base md:leading-[1.6]">{comment.content}</p>
            </BlindedContent>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-[1.65] text-[var(--ui-text)] [overflow-wrap:anywhere] md:text-base md:leading-[1.6]">{comment.content}</p>
          )}
          {!reply ? (
            <div className="mt-1.5 flex items-center gap-3">
              <button type="button" onClick={() => setReplyTo((current) => current === comment.id ? null : comment.id)} className="text-[13px] font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">답글쓰기</button>
              <ReportButton target="comment" commentId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} />
              {guestEditButton(comment)}
              {guestDeleteButton(comment)}
            </div>
          ) : <div className="mt-1.5 flex items-center gap-3"><ReportButton target="comment" commentId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} />{guestEditButton(comment)}{guestDeleteButton(comment)}</div>}
        </div>
      </div>
      {replyTo === comment.id ? (
        <div className="mt-3 ml-0 sm:ml-10">
          <CommentForm postId={comment.postId} parentId={comment.id} scope={scope} teamSlug={teamSlug} isGuest={!viewerId} onSubmitted={() => setReplyTo(null)} />
        </div>
      ) : null}
    </div>
  );

  return (
    <ul className="min-w-0 divide-y divide-[var(--ui-border)] px-[14px] md:px-8">
      {roots.map((comment) => (
        <li key={comment.id}>
          {comment.deletedAt ? deletedItem(comment) : item(comment)}
          {(repliesByParent.get(comment.id) ?? []).map((reply) => item(reply, true))}
        </li>
      ))}
    </ul>
  );
}
