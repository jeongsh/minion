"use client";

import { ChevronDown, ChevronUp, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { BlindedContent } from "@/components/community/blinded-content";
import { AuthorMenu } from "@/components/community/author-menu";
import { CommentForm } from "@/components/community/comment-form";
import { formatRelativeOrDate } from "@/components/community/format";
import { ReactionButtons } from "@/components/community/reaction-buttons";
import { ReportButton } from "@/components/community/report-button";
import { RankAvatar } from "@/components/rank/rank-avatar";
import { useToast } from "@/components/ui/toast";
import { deleteGuestCommentAction, updateGuestCommentAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";
import { blindLabel } from "@/lib/community/moderation-labels";
import type { CommunityCommentItem, ReactionState } from "@/lib/community/types";
import { useCommentMaxLength } from "@/components/community/use-comment-max-length";
import { selectBestComments } from "@/lib/community/best-comments";

export function CommentList({ comments, commentReactions, scope, teamSlug, viewerId, currentGuestKey }: { comments: CommunityCommentItem[]; commentReactions: Record<string, ReactionState>; scope: BoardScope; teamSlug?: string; viewerId?: string | null; currentGuestKey?: string | null }) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  const maxLength = useCommentMaxLength();
  const roots = comments.filter((comment) => !comment.parentId);
  const bestComments = selectBestComments(roots);
  const bestCommentIds = new Set(bestComments.map((comment) => comment.id));
  const orderedRoots = [...bestComments, ...roots.filter((comment) => !bestCommentIds.has(comment.id))];
  const repliesByParent = new Map<string, CommunityCommentItem[]>();
  comments.filter((comment) => comment.parentId).forEach((comment) => {
    const replies = repliesByParent.get(comment.parentId!) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parentId!, replies);
  });

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((current) => {
      const next = new Set(current);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

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

  const commentAvatar = (comment: CommunityCommentItem, reply: boolean) => comment.authorId ? (
    <RankAvatar tier={comment.authorTier} src={comment.authorImageUrl} alt={comment.authorName ?? "알 수 없음"} fallback={(comment.authorName ?? "?").charAt(0)} size={reply ? "reply" : "detail"} />
  ) : (
    <span className={`grid shrink-0 place-items-center rounded-full bg-[var(--ui-surface-muted)] text-[var(--ui-muted)] ${reply ? "h-6 w-6" : "h-9 w-9"}`} aria-hidden="true"><UserRound size={reply ? 14 : 20} strokeWidth={1.7} /></span>
  );

  const item = (comment: CommunityCommentItem, reply = false, continued = false, best = false) => (
    <div key={comment.id} className={`relative grid min-h-[78px] min-w-0 gap-4 ${reply ? "grid-cols-[24px_minmax(0,1fr)]" : "grid-cols-[36px_minmax(0,1fr)]"}`}>
      {continued ? <span className="absolute bottom-0 left-[18px] top-10 border-l border-[var(--ui-border)]" aria-hidden="true" /> : null}
      {commentAvatar(comment, reply)}
      <div className="relative min-w-0">
        <div className="flex h-5 min-w-0 items-center gap-1 pr-8">
          {best ? <span className="mr-1 shrink-0 rounded bg-blue-500 px-1.5 py-0.5 text-xs font-medium leading-none text-white">BEST</span> : null}
          <AuthorMenu
            authorId={comment.authorId}
            authorName={comment.authorName}
            authorImageUrl={comment.authorImageUrl}
            authorTier={comment.authorTier}
            authorTeam={comment.authorTeam}
            guestKey={comment.guestKey}
            viewerId={viewerId}
            variant="comment"
            evidencePostId={comment.postId}
            evidenceCommentId={comment.id}
            scope={scope}
            teamSlug={teamSlug}
            hideAvatar
          />
          <span className="shrink-0 text-xs leading-[18px] text-[var(--ui-muted)]">{formatRelativeOrDate(comment.createdAt)}</span>
          <span className="absolute -top-1.5 right-0"><ReportButton target="comment" commentId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} /></span>
        </div>
        {editingId === comment.id ? (
          <div className="mt-1.5 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3">
            <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={4} maxLength={maxLength} className="block w-full resize-none bg-transparent text-base leading-7 text-[var(--ui-text)] outline-none" aria-label="댓글 수정" />
            <div className="mt-2 flex items-center justify-end gap-2">
              <span className="mr-auto text-[13px] tabular-nums text-[var(--ui-muted)]">{editingContent.length.toLocaleString("ko-KR")}/{maxLength.toLocaleString("ko-KR")}자</span>
              <button type="button" disabled={pending} onClick={() => setEditingId(null)} className="h-8 rounded-[var(--ui-control-radius)] px-3 text-[13px] font-medium text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]">취소</button>
              <button type="button" disabled={pending || !editingContent.trim() || editingContent.length > maxLength} onClick={() => saveGuestEdit(comment)} className="h-8 rounded-[var(--ui-control-radius)] bg-[var(--ui-ink)] px-3 text-[13px] font-medium text-[var(--ui-surface)] disabled:opacity-50">{pending ? "저장 중" : "저장"}</button>
            </div>
          </div>
        ) : comment.blindedAt ? (
          <BlindedContent compact label={blindLabel(comment.blindedSource, "comment")} source={comment.blindedSource}>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 text-[var(--ui-text)] [overflow-wrap:anywhere]">{comment.content}</p>
          </BlindedContent>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 text-[var(--ui-text)] [overflow-wrap:anywhere]">{comment.content}</p>
        )}
        <div className="-ml-2 mt-1 flex h-8 items-center gap-2">
          <ReactionButtons target="comment" targetId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} initialState={commentReactions[comment.id] ?? null} initialHonorCount={comment.likeCount} initialDislikeCount={comment.dislikeCount} size="sm" />
          {!reply ? <button type="button" onClick={() => setReplyTo((current) => current === comment.id ? null : comment.id)} className="h-8 rounded-[var(--ui-control-radius)] px-2 text-[13px] font-medium text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]">답글</button> : null}
          {guestEditButton(comment)}
          {guestDeleteButton(comment)}
        </div>
        {replyTo === comment.id ? <div className="mt-2"><CommentForm postId={comment.postId} parentId={comment.id} scope={scope} teamSlug={teamSlug} isGuest={!viewerId} onSubmitted={() => setReplyTo(null)} /></div> : null}
      </div>
    </div>
  );

  return (
    <ul className="min-w-0 px-[14px] md:px-8">
      {orderedRoots.map((comment, index) => {
        const replyItems = repliesByParent.get(comment.id) ?? [];
        const expanded = expandedReplies.has(comment.id);
        const best = bestCommentIds.has(comment.id);
        const firstRegular = bestComments.length > 0 && index === bestComments.length;
        return (
          <li key={comment.id} className={`mb-4 ${best ? "-mx-2 rounded-lg bg-blue-500/[0.07] px-2 pt-3" : ""} ${firstRegular ? "border-t border-[var(--ui-border)] pt-5" : ""}`}>
            {comment.deletedAt ? deletedItem(comment) : item(comment, false, replyItems.length > 0, best)}
            {replyItems.length > 0 && !expanded ? (
              <div className="relative h-[52px]">
                <span className="absolute left-[18px] top-0 h-[30px] w-[18px] rounded-bl-[16px] border-b border-l border-[var(--ui-border)]" aria-hidden="true" />
                <button type="button" onClick={() => toggleReplies(comment.id)} aria-expanded="false" className="absolute left-9 top-3 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]">
                  답글 {replyItems.length}개 <ChevronDown size={18} strokeWidth={2} />
                </button>
              </div>
            ) : null}
            {replyItems.length > 0 && expanded ? (
              <div>
                {replyItems.map((reply) => (
                  <div key={reply.id} className="relative min-h-[90px]">
                    <span className="absolute bottom-0 left-[18px] top-0 border-l border-[var(--ui-border)]" aria-hidden="true" />
                    <span className="absolute left-[18px] top-0 h-6 w-[30px] rounded-bl-[16px] border-b border-l border-[var(--ui-border)]" aria-hidden="true" />
                    <div className="ml-12 pt-3">
                      {item(reply, true)}
                    </div>
                  </div>
                ))}
                <div className="relative h-[52px]">
                  <span className="absolute left-[18px] top-0 h-[30px] w-[18px] rounded-bl-[16px] border-b border-l border-[var(--ui-border)]" aria-hidden="true" />
                  <button type="button" onClick={() => toggleReplies(comment.id)} aria-expanded="true" className="absolute left-9 top-3 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]">
                    답글 숨기기 <ChevronUp size={18} strokeWidth={2} />
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
