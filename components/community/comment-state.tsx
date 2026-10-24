"use client";

import { createContext, useContext, useState } from "react";
import type { CommunityCommentItem } from "@/lib/community/types";
import type { MiniconItem } from "@/lib/minicons/types";

type Entry = { comment: CommunityCommentItem; pending: boolean; before?: Entry };
type CommentState = {
  comments: CommunityCommentItem[];
  count: number;
  pendingIds: Set<string>;
  begin: (parentId: string | undefined, content: string, minicons?: MiniconItem[]) => string;
  patch: (comment: CommunityCommentItem) => void;
  settle: (id: string, comment?: CommunityCommentItem) => void;
  rollback: (id: string) => void;
};
const Context = createContext<CommentState | null>(null);

export function CommentStateProvider({ comments: initial, count, postId, children }: { comments: CommunityCommentItem[]; count: number; postId: string; children: React.ReactNode }) {
  const [serverComments, setServerComments] = useState(initial);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  if (serverComments !== initial) {
    setServerComments(initial);
    setEntries(previous => Object.fromEntries(Object.entries(previous).filter(([id, entry]) => {
      if (entry.pending || id.startsWith("pending:")) return true;
      const current = initial.find(comment => comment.id === id);
      return entry.comment.deletedAt ? Boolean(current && !current.deletedAt) : !current || current.content !== entry.comment.content;
    })));
  }
  const merged = new Map(initial.map(comment => [comment.id, comment]));
  for (const [id, entry] of Object.entries(entries)) merged.set(id, entry.comment);
  const all = [...merged.values()];
  const parentIds = new Set(all.filter(comment => !comment.deletedAt).map(comment => comment.parentId));
  const comments = all.filter(comment => !comment.deletedAt || parentIds.has(comment.id));
  const pendingIds = new Set(Object.entries(entries).filter(([, entry]) => entry.pending).map(([id]) => id));
  const delta = Object.entries(entries).reduce((sum, [id, entry]) => {
    const original = initial.find(comment => comment.id === id);
    return sum + (!original && !entry.comment.deletedAt ? 1 : original && !original.deletedAt && entry.comment.deletedAt ? -1 : 0);
  }, 0);
  const rollback = (id: string) => setEntries(previous => {
    const next = { ...previous };
    if (next[id]?.before) next[id] = next[id].before;
    else delete next[id];
    return next;
  });
  return <Context.Provider value={{ comments, count: Math.max(0, count + delta), pendingIds, rollback,
    begin(parentId, content, minicons = []) {
      const id = `pending:${crypto.randomUUID()}`;
      const comment: CommunityCommentItem = { id, postId, parentId: parentId ?? null, content, minicons, contentKind: minicons.length ? "minicon" : "text", authorId: null, authorName: "등록 중", authorImageUrl: null, authorTier: "iron", authorTeam: null, guestKey: null, guestIpLabel: null, likeCount: 0, dislikeCount: 0, createdAt: new Date().toISOString(), blindedAt: null, blindedSource: null, deletedAt: null };
      setEntries(previous => ({ ...previous, [id]: { comment, pending: true } }));
      return id;
    },
    patch(comment) { setEntries(previous => ({ ...previous, [comment.id]: { comment, pending: true, before: previous[comment.id] } })); },
    settle(id, comment) { setEntries(previous => {
      const next = { ...previous };
      const current = next[id];
      delete next[id];
      if (comment) next[comment.id] = { comment, pending: false };
      else if (current) next[id] = { comment: current.comment, pending: false };
      return next;
    }); },
  }}>{children}</Context.Provider>;
}

export function useCommentState() { return useContext(Context); }
export function CommentCount({ fallback }: { fallback: number }) {
  const state = useCommentState();
  return <>{state?.count ?? fallback}</>;
}
