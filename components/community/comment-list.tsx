"use client";

import { useState } from "react";

import { CommentForm } from "@/components/community/comment-form";
import { formatRelativeOrDate } from "@/components/community/format";
import { ReactionButtons } from "@/components/community/reaction-buttons";
import { ReportButton } from "@/components/community/report-button";
import type { BoardScope } from "@/lib/community/boards";
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

  const item = (comment: CommunityCommentItem, reply = false) => (
    <div key={comment.id} className={reply ? "relative ml-10 border-t border-[var(--ui-border)] py-5 pl-5 before:absolute before:left-0 before:top-6 before:h-3 before:w-3 before:border-b before:border-l before:border-[var(--ui-border)] sm:ml-14" : "py-5"}>
      <div className="flex gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ui-surface-muted)] text-[12px] font-bold text-[var(--ui-muted)]">
          {comment.authorImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={comment.authorImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (comment.authorName ?? "글").charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-bold text-[var(--ui-ink)]">{comment.authorName ?? "작성자"}</span>
            <span className="text-[12px] text-[var(--ui-muted)]">{formatRelativeOrDate(comment.createdAt)}</span>
            <div className="ml-auto"><ReactionButtons target="comment" targetId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} initialState={commentReactions[comment.id] ?? null} initialHonorCount={comment.likeCount} initialDislikeCount={comment.dislikeCount} size="sm" /></div>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.65] text-[var(--ui-text)]">{comment.content}</p>
          {!reply ? (
            <div className="mt-3 flex items-center gap-3">
              <button type="button" onClick={() => setReplyTo((current) => current === comment.id ? null : comment.id)} className="text-[12px] font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">답글쓰기</button>
              <ReportButton target="comment" commentId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} />
            </div>
          ) : <div className="mt-3"><ReportButton target="comment" commentId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} /></div>}
        </div>
      </div>
      {replyTo === comment.id ? (
        <div className="mt-5 ml-12">
          <CommentForm postId={comment.postId} parentId={comment.id} scope={scope} teamSlug={teamSlug} onSubmitted={() => setReplyTo(null)} />
        </div>
      ) : null}
    </div>
  );

  return (
    <ul className="divide-y divide-[var(--ui-border)] px-5 sm:px-8">
      {roots.map((comment) => (
        <li key={comment.id}>
          {item(comment)}
          {(repliesByParent.get(comment.id) ?? []).map((reply) => item(reply, true))}
        </li>
      ))}
    </ul>
  );
}
