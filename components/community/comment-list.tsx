"use client";

import { useState } from "react";

import { BlindedContent } from "@/components/community/blinded-content";
import { CommentForm } from "@/components/community/comment-form";
import { formatRelativeOrDate } from "@/components/community/format";
import { ReactionButtons } from "@/components/community/reaction-buttons";
import { ReportButton } from "@/components/community/report-button";
import type { BoardScope } from "@/lib/community/boards";
import { blindLabel } from "@/lib/community/moderation-labels";
import type { CommunityCommentItem, ReactionState } from "@/lib/community/types";

export function CommentList({ comments, commentReactions, scope, teamSlug }: { comments: CommunityCommentItem[]; commentReactions: Record<string, ReactionState>; scope: BoardScope; teamSlug?: string }) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const roots = comments.filter((comment) => !comment.parentId);
  const repliesByParent = new Map<string, CommunityCommentItem[]>();
  comments.filter((comment) => comment.parentId).forEach((comment) => {
    const replies = repliesByParent.get(comment.parentId!) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parentId!, replies);
  });

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
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ui-surface-muted)] text-[13px] font-bold text-[var(--ui-muted)]">
          {comment.authorImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={comment.authorImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (comment.authorName ?? "글").charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-[var(--ui-ink)]">{comment.authorName ?? "작성자"}</span>
              <span className="shrink-0 text-[13px] text-[var(--ui-muted)]">{formatRelativeOrDate(comment.createdAt)}</span>
            </div>
            <div className="-my-1">
              <ReactionButtons target="comment" targetId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} initialState={commentReactions[comment.id] ?? null} initialHonorCount={comment.likeCount} initialDislikeCount={comment.dislikeCount} size="sm" />
            </div>
          </div>
          {comment.blindedAt ? (
            <BlindedContent compact label={blindLabel(comment.blindedSource, "comment")}>
              <p className="mt-1 whitespace-pre-wrap break-words text-base leading-[1.6] text-[var(--ui-text)] [overflow-wrap:anywhere]">{comment.content}</p>
            </BlindedContent>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-base leading-[1.6] text-[var(--ui-text)] [overflow-wrap:anywhere]">{comment.content}</p>
          )}
          {!reply ? (
            <div className="mt-1.5 flex items-center gap-3">
              <button type="button" onClick={() => setReplyTo((current) => current === comment.id ? null : comment.id)} className="text-[13px] font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">답글쓰기</button>
              <ReportButton target="comment" commentId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} />
            </div>
          ) : <div className="mt-1.5"><ReportButton target="comment" commentId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} /></div>}
        </div>
      </div>
      {replyTo === comment.id ? (
        <div className="mt-3 ml-0 sm:ml-10">
          <CommentForm postId={comment.postId} parentId={comment.id} scope={scope} teamSlug={teamSlug} onSubmitted={() => setReplyTo(null)} />
        </div>
      ) : null}
    </div>
  );

  return (
    <ul className="min-w-0 divide-y divide-[var(--ui-border)] px-4 sm:px-8">
      {roots.map((comment) => (
        <li key={comment.id}>
          {comment.deletedAt ? deletedItem(comment) : item(comment)}
          {(repliesByParent.get(comment.id) ?? []).map((reply) => item(reply, true))}
        </li>
      ))}
    </ul>
  );
}
