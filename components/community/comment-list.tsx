"use client";

import { ChevronDown, ChevronUp, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_COMMENT_REPLY_DEPTH } from "@/packages/contracts/src/community-comment-thread";

import { BlindedContent } from "@/components/community/blinded-content";
import { AuthorMenu } from "@/components/community/author-menu";
import { CommentForm } from "@/components/community/comment-form";
import { RelativeDate } from "@/components/community/relative-date";
import { ReactionButtons } from "@/components/community/reaction-buttons";
import { ReportButton } from "@/components/community/report-button";
import { RankAvatar } from "@/components/rank/rank-avatar";
import { useToast } from "@/components/ui/toast";
import { deleteCommentAction, updateCommentAction } from "@/lib/community/actions";
import type { BoardScope } from "@/lib/community/boards";
import { blindLabel } from "@/lib/community/moderation-labels";
import type { CommunityCommentItem, ReactionState } from "@/lib/community/types";
import type { MiniconPack } from "@/lib/minicons/types";
import { useCommentState } from "@/components/community/comment-state";
import { useCommentMaxLength } from "@/components/community/use-comment-max-length";
import { selectBestComments } from "@/lib/community/best-comments";

const EMPTY_DELETED_COMMENT_IDS: string[] = [];

export function CommentList({ comments: initialComments, deletedCommentIds = EMPTY_DELETED_COMMENT_IDS, commentReactions, scope, teamSlug, viewerId, currentGuestKey, miniconPacks = [], managedAiCommentIds = [] }: { comments: CommunityCommentItem[]; deletedCommentIds?: string[]; commentReactions: Record<string, ReactionState>; scope: BoardScope; teamSlug?: string; viewerId?: string | null; currentGuestKey?: string | null; miniconPacks?: MiniconPack[]; managedAiCommentIds?: string[] }) {
  const commentState = useCommentState();
  const comments = commentState?.comments ?? initialComments;
  const router = useRouter();
  const { showToast } = useToast();
  const deletedToastTarget = useRef<string | null>(null);
  const [refreshSnapshot, setRefreshSnapshot] = useState<CommunityCommentItem[] | null>(null);
  const waitingForRefresh = refreshSnapshot === initialComments;
  const refreshRequestedFor = useRef<string | null>(null);
  const requestedTarget = useRef<{ pathname: string; id: string | null } | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [collapsedReplies, setCollapsedReplies] = useState<Set<string>>(() => new Set());
  const [commentTarget, setCommentTarget] = useState<{ id: string | null; revision: number }>({ id: null, revision: 0 });
  const targetId = commentTarget.id;
  const targetComment = comments.find(comment => comment.id === targetId);
  const targetAvailable = Boolean(targetComment);
  const targetDeleted = Boolean(targetComment?.deletedAt || (targetId && deletedCommentIds.includes(targetId)));
  useEffect(() => {
    const followComment = (event?: Event) => {
      const hashId = window.location.hash.startsWith("#comment-") ? window.location.hash.slice(9) : null;
      const pendingId = requestedTarget.current?.pathname === window.location.pathname ? requestedTarget.current.id : null;
      const id = event instanceof CustomEvent ? event.detail as string : event ? hashId : pendingId ?? hashId;
      requestedTarget.current = { pathname: window.location.pathname, id };
      const target = comments.find(comment => comment.id === id);
      // Keep the requested id while refreshed server comments are still loading.
      const nextId = id;
      setCommentTarget(current => current.id === nextId && !event ? current : { id: nextId, revision: current.revision + 1 });
      const deleted = Boolean(target?.deletedAt || (id && deletedCommentIds.includes(id)));
      if (id && !deleted && (!target || event instanceof CustomEvent)) {
        const requestKey = `${window.location.pathname}#${id}`;
        if (event || refreshRequestedFor.current !== requestKey) {
          refreshRequestedFor.current = requestKey;
          setRefreshSnapshot(initialComments);
          router.refresh();
        }
      } else {
        refreshRequestedFor.current = null;
      }
      const parentId = target?.parentId;
      if (parentId) setCollapsedReplies(current => {
        const next = new Set(current);
        next.delete(parentId);
        const grandparentId = comments.find(comment => comment.id === parentId)?.parentId;
        if (grandparentId) next.delete(grandparentId);
        return next.size === current.size ? current : next;
      });
    };
    followComment();
    window.addEventListener("hashchange", followComment);
    window.addEventListener("community:comment-target", followComment);
    return () => {
      window.removeEventListener("hashchange", followComment);
      window.removeEventListener("community:comment-target", followComment);
    };
  }, [comments, deletedCommentIds, initialComments, router]);
  useEffect(() => {
    if (!targetId || waitingForRefresh) return;
    if (targetDeleted) {
      const toastKey = `${window.location.pathname}:${targetId}:${commentTarget.revision}`;
      if (deletedToastTarget.current !== toastKey) {
        deletedToastTarget.current = toastKey;
        if (window.location.hash !== `#comment-${targetId}`) window.history.pushState(null, "", `#comment-${targetId}`);
        showToast({ title: "이미 삭제된 댓글입니다.", tone: "info" });
      }
      return;
    }
    if (!targetAvailable) return;
    let highlight: Animation | undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`comment-${targetId}`);
      if (target && window.location.hash !== `#comment-${targetId}`) window.history.pushState(null, "", `#comment-${targetId}`);
      target?.scrollIntoView({ block: "center" });
      target?.focus({ preventScroll: true });
      highlight = target?.querySelector("[data-comment-text]")?.animate([
        { backgroundColor: "var(--palette-green-butter-point)" },
        { backgroundColor: "transparent" },
      ], { duration: 2000, easing: "ease-out" });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      highlight?.cancel();
    };
  }, [targetId, targetAvailable, targetDeleted, commentTarget.revision, waitingForRefresh, showToast]);
  const pendingParents = comments.filter(comment => comment.parentId && commentState?.pendingIds.has(comment.id)).map(comment => comment.parentId!);
  if (pendingParents.some(id => collapsedReplies.has(id))) {
    setCollapsedReplies(previous => new Set([...previous].filter(id => !pendingParents.includes(id))));
  }
  const [pending, startTransition] = useTransition();
  const maxLength = useCommentMaxLength();
  const editLimit = (comment: CommunityCommentItem) => managedAiCommentIds.includes(comment.id) ? Math.max(620, maxLength) : maxLength;
  const roots = comments.filter((comment) => !comment.parentId);
  const bestComments = selectBestComments(roots.filter(comment => !comment.id.startsWith("pending:")));
  const bestCommentIds = new Set(bestComments.map((comment) => comment.id));
  const orderedRoots = [...bestComments, ...roots.filter((comment) => !bestCommentIds.has(comment.id))];
  const repliesByParent = new Map<string, CommunityCommentItem[]>();
  comments.filter((comment) => comment.parentId).forEach((comment) => {
    const replies = repliesByParent.get(comment.parentId!) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parentId!, replies);
  });

  const toggleReplies = (commentId: string) => {
    setCollapsedReplies((current) => {
      const next = new Set(current);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const removeComment = (comment: CommunityCommentItem) => {
    if (!window.confirm("이 댓글을 삭제할까요?")) return;
    commentState?.patch({ ...comment, content: "", deletedAt: new Date().toISOString() });
    startTransition(async () => {
      try {
      const result = await deleteCommentAction({
        commentId: comment.id,
        postId: comment.postId,
        scope,
        teamSlug,
      });
      showToast({
        title: result.ok ? (result.message ?? "댓글을 삭제했습니다.") : result.error,
        tone: result.ok ? "success" : "error",
      });
      if (result.ok) { commentState?.settle(comment.id); router.refresh(); }
      else commentState?.rollback(comment.id);
      } catch { commentState?.rollback(comment.id); showToast({ title: "댓글을 삭제하지 못했습니다. 다시 시도해 주세요.", tone: "error" }); }
    });
  };

  const ownsComment = (comment: CommunityCommentItem) => !comment.id.startsWith("pending:") && (managedAiCommentIds.includes(comment.id) || (comment.authorId
    ? comment.authorId === viewerId
    : Boolean(comment.guestKey && comment.guestKey === currentGuestKey)));

  const beginEdit = (comment: CommunityCommentItem) => {
    setEditingId(comment.id);
    setEditingContent(comment.content);
    setReplyTo(null);
  };

  const saveEdit = (comment: CommunityCommentItem) => {
    const nextContent = editingContent.trim();
    commentState?.patch({ ...comment, content: nextContent });
    setEditingId(null);
    startTransition(async () => {
      try {
      const result = await updateCommentAction({
        commentId: comment.id,
        postId: comment.postId,
        content: nextContent,
        scope,
        teamSlug,
      });
      showToast({
        title: result.ok ? (result.message ?? "댓글을 수정했습니다.") : result.error,
        tone: result.ok ? "success" : "error",
      });
      if (result.ok) {
        setEditingId(null);
        setEditingContent("");
        commentState?.settle(comment.id);
        router.refresh();
      } else { commentState?.rollback(comment.id); setEditingId(comment.id); setEditingContent(nextContent); }
      } catch { commentState?.rollback(comment.id); setEditingId(comment.id); setEditingContent(nextContent); showToast({ title: "댓글을 수정하지 못했습니다. 다시 시도해 주세요.", tone: "error" }); }
    });
  };

  if (comments.length === 0) return null;

  // 삭제된 댓글: 답글 유지를 위한 자리표시만 남긴다(본문은 서버에서 이미 비워짐).
  const deletedItem = (comment: CommunityCommentItem) => (
    <div key={comment.id} id={`comment-${comment.id}`} tabIndex={-1} className="scroll-mt-24 py-3.5">
      <p className="text-sm text-[var(--ui-muted)]">삭제된 댓글입니다.</p>
    </div>
  );

  const commentAvatar = (comment: CommunityCommentItem, reply: boolean) => comment.authorId ? (
    <RankAvatar tier={comment.authorTier} src={comment.authorImageUrl} alt={comment.authorName ?? "알 수 없음"} fallback={(comment.authorName ?? "?").charAt(0)} size={reply ? "reply" : "detail"} />
  ) : (
    <span className={`grid shrink-0 place-items-center rounded-full bg-[var(--ui-surface-muted)] text-[var(--ui-muted)] ${reply ? "h-6 w-6" : "h-9 w-9"}`} aria-hidden="true"><UserRound size={reply ? 14 : 20} strokeWidth={1.7} /></span>
  );

  const authorMenu = (comment: CommunityCommentItem, avatar?: React.ReactNode) => (
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
      customTrigger={avatar}
      hideAvatar
    />
  );

  const commentBody = (comment: CommunityCommentItem) => comment.contentKind === "minicon" ? (
    comment.minicons.length > 0 ? (
      <figure className="mt-2 flex w-fit items-start gap-0">
        {comment.minicons.map((minicon) => (
          // 미니콘 두 장은 400×200 원본처럼 이어지도록 간격·테두리·곡선을 두지 않는다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={minicon.id}
            src={minicon.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="block h-[100px] w-[100px] shrink-0 object-cover"
          />
        ))}
        <figcaption className="sr-only">{comment.minicons.map((minicon) => minicon.name).join(", ")} 미니콘</figcaption>
      </figure>
    ) : (
      <div className="mt-2 grid h-[100px] w-[100px] place-items-center rounded-[18px] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 text-center text-[13px] font-normal leading-5 text-[var(--ui-muted)]">
        사용할 수 없는 미니콘
      </div>
    )
  ) : (
    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 text-[var(--ui-text)] [overflow-wrap:anywhere]"><span data-comment-text="">{comment.content}</span></p>
  );

  const item = (comment: CommunityCommentItem, depth: number, continued: boolean, best: boolean) => (
    <div id={`comment-${comment.id}`} tabIndex={-1} aria-busy={commentState?.pendingIds.has(comment.id) || undefined} className={`relative grid min-h-[78px] min-w-0 scroll-mt-24 gap-4 outline-none ${depth > 0 ? "grid-cols-[24px_minmax(0,1fr)]" : "grid-cols-[36px_minmax(0,1fr)]"}`}>
      {continued ? <span className={`absolute bottom-0 top-10 border-l border-[var(--ui-border)] ${depth > 0 ? "left-3" : "left-[18px]"}`} aria-hidden="true" /> : null}
      {authorMenu(comment, commentAvatar(comment, depth > 0))}
      <div className="relative min-w-0">
        <div className="flex h-5 min-w-0 items-center gap-1 pr-8">
          {best ? <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--palette-green-butter-main)] px-1.5 py-0.5 text-xs font-medium leading-none text-[#071a11]">BEST</span> : null}
          {authorMenu(comment)}
          <span className="shrink-0 text-[13px] leading-[18px] text-[var(--ui-muted)]"><RelativeDate value={comment.createdAt} /></span>
          <span hidden={comment.id.startsWith("pending:")} className="absolute -top-1.5 right-0">
            {ownsComment(comment) ? (
              <button type="button" disabled={pending} onClick={() => removeComment(comment)} aria-label={pending ? "댓글 삭제 중" : "댓글 삭제"} className="grid h-8 w-8 place-items-center rounded-full text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"><Trash2 size={17} strokeWidth={1.8} /></button>
            ) : (
              <ReportButton target="comment" commentId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} />
            )}
          </span>
        </div>
        {editingId === comment.id ? (
          <div className="mt-1.5 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3">
            <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={4} maxLength={editLimit(comment)} className="block w-full resize-none bg-transparent text-base leading-7 text-[var(--ui-text)] outline-none" aria-label="댓글 수정" />
            <div className="mt-2 flex items-center justify-end gap-2">
              <span className="mr-auto text-[13px] tabular-nums text-[var(--ui-muted)]">{editingContent.length.toLocaleString("ko-KR")}/{editLimit(comment).toLocaleString("ko-KR")}자</span>
              <button type="button" disabled={pending} onClick={() => setEditingId(null)} className="h-8 rounded-[var(--ui-control-radius)] px-3 text-[13px] font-medium text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]">취소</button>
              <button type="button" disabled={pending || !editingContent.trim() || editingContent.length > editLimit(comment)} onClick={() => saveEdit(comment)} className="h-8 rounded-[var(--ui-control-radius)] bg-[var(--ui-ink)] px-3 text-[13px] font-medium text-[var(--ui-surface)] disabled:opacity-50">{pending ? "저장 중" : "저장"}</button>
            </div>
          </div>
        ) : comment.blindedAt ? (
          <BlindedContent compact label={blindLabel(comment.blindedSource, "comment")} source={comment.blindedSource}>
            {commentBody(comment)}
          </BlindedContent>
        ) : (
          commentBody(comment)
        )}
        <div className={`-ml-2 mt-1 flex h-8 items-center gap-2 ${comment.id.startsWith("pending:") ? "pointer-events-none opacity-50" : ""}`} inert={comment.id.startsWith("pending:")}>
          <ReactionButtons target="comment" targetId={comment.id} postId={comment.postId} scope={scope} teamSlug={teamSlug} initialState={commentReactions[comment.id] ?? null} initialHonorCount={comment.likeCount} initialDislikeCount={comment.dislikeCount} size="sm" />
          {depth < MAX_COMMENT_REPLY_DEPTH ? <button type="button" aria-expanded={replyTo === comment.id} onClick={() => setReplyTo((current) => current === comment.id ? null : comment.id)} className="h-8 rounded-[var(--ui-control-radius)] px-2 text-[13px] font-medium text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]">답글</button> : null}
          {comment.contentKind === "text" && ownsComment(comment) ? (
            <button type="button" disabled={pending} onClick={() => beginEdit(comment)} className="h-8 rounded-[var(--ui-control-radius)] px-2 text-[13px] font-medium text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)] disabled:opacity-50">수정</button>
          ) : null}
        </div>
        {replyTo === comment.id ? <div className="mt-2"><CommentForm postId={comment.postId} parentId={comment.id} scope={scope} teamSlug={teamSlug} isGuest={!viewerId} miniconPacks={miniconPacks} onSubmitted={() => setReplyTo(current => current === comment.id ? null : current)} /></div> : null}
      </div>
    </div>
  );

  const thread = (comment: CommunityCommentItem, depth: number, best = false) => {
    const replies = depth < MAX_COMMENT_REPLY_DEPTH ? repliesByParent.get(comment.id) ?? [] : [];
    const expanded = !collapsedReplies.has(comment.id);
    const stemOffset = depth === 0 ? "left-[18px]" : "left-3";

    return (
      <>
        {comment.deletedAt ? deletedItem(comment) : item(comment, depth, replies.length > 0, best)}
        {replies.length > 0 ? (
          <>
            {expanded ? (
              <ul>
                {replies.map(reply => (
                  <li key={reply.id} className="relative min-h-[90px]">
                    <span className={`absolute bottom-0 top-0 border-l border-[var(--ui-border)] ${stemOffset}`} aria-hidden="true" />
                    <span className={`absolute top-0 h-6 rounded-bl-[16px] border-b border-l border-[var(--ui-border)] ${stemOffset} ${depth === 0 ? "w-[30px]" : "w-5"}`} aria-hidden="true" />
                    <div className={`pt-3 ${depth === 0 ? "ml-12" : "ml-8"}`}>
                      {thread(reply, depth + 1)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="relative h-[52px]">
              <span className={`absolute top-0 h-[30px] w-[18px] rounded-bl-[16px] border-b border-l border-[var(--ui-border)] ${stemOffset}`} aria-hidden="true" />
              <button type="button" onClick={() => toggleReplies(comment.id)} aria-expanded={expanded} className={`absolute top-3 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)] ${depth === 0 ? "left-9" : "left-[30px]"}`}>
                {expanded ? <>답글 숨기기 <ChevronUp size={18} strokeWidth={2} /></> : <>답글 {replies.length}개 <ChevronDown size={18} strokeWidth={2} /></>}
              </button>
            </div>
          </>
        ) : null}
      </>
    );
  };

  return (
    <ul className="min-w-0 px-[14px] md:px-8">
      {orderedRoots.map((comment, index) => {
        const firstRegular = bestComments.length > 0 && index === bestComments.length;
        return (
          <li key={comment.id} className={`mb-4 ${firstRegular ? "border-t border-[var(--ui-border)] pt-5" : ""}`}>
            {thread(comment, 0, bestCommentIds.has(comment.id))}
          </li>
        );
      })}
    </ul>
  );
}
