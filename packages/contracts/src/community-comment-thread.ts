export const MAX_COMMENT_REPLY_DEPTH = 2;

export function retainCommentAncestors<T extends { id: string }>(
  comments: T[],
  getParentId: (comment: T) => string | null,
  isDeleted: (comment: T) => boolean,
): T[] {
  const byId = new Map(comments.map(comment => [comment.id, comment]));
  const visible = comments.filter(comment => !isDeleted(comment));
  const retainedIds = new Set(visible.map(comment => comment.id));

  for (const comment of visible) {
    let parentId = getParentId(comment);
    while (parentId && !retainedIds.has(parentId)) {
      const parent = byId.get(parentId);
      if (!parent) break;
      retainedIds.add(parentId);
      parentId = getParentId(parent);
    }
  }

  return comments.filter(comment => retainedIds.has(comment.id));
}
