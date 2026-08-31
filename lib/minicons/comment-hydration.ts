import type { CommentMinicon } from "./types";

export const RENDERABLE_MINICON_PACK_STATUSES = ["published", "retired"] as const;

type HydrationItem = {
  id: string;
  packId: string;
  name: string;
  imageUrl: string;
};

type HydrationPack = {
  id: string;
  name: string;
  status: string;
};

/**
 * 저장된 댓글을 복원할 때만 쓰는 매퍼다. 공개 종료(retired)는 과거 댓글을
 * 보존하지만, 정지·심사·반려 패키지는 렌더링하지 않는다.
 */
export function resolveRenderableCommentMinicons(
  items: HydrationItem[],
  packs: HydrationPack[],
): Map<string, CommentMinicon> {
  const renderableStatuses = new Set<string>(RENDERABLE_MINICON_PACK_STATUSES);
  const packNames = new Map(
    packs
      .filter((pack) => renderableStatuses.has(pack.status))
      .map((pack) => [pack.id, pack.name]),
  );

  return new Map(items.flatMap((item) => {
    const packName = packNames.get(item.packId);
    return packName ? [[item.id, {
      id: item.id,
      packId: item.packId,
      packName,
      name: item.name,
      imageUrl: item.imageUrl,
    } satisfies CommentMinicon] as const] : [];
  }));
}
