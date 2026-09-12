import type { PlayerBuildEvent } from "@/lib/data/lck";

/** 라이엇 타임라인 skillSlot 값: 1=Q, 2=W, 3=E, 4=R. */
export type SkillLevelUp = {
  level: number;
  slot: 1 | 2 | 3 | 4;
};

export type ItemPurchase = {
  itemId: number;
  timestampMs: number;
  minute: number;
  sold: boolean;
};

export type ItemPurchaseGroup = {
  /** 그룹의 시작 시각(첫 구매 타임스탬프) 기준 분. */
  minute: number;
  purchases: ItemPurchase[];
};

export type PlayerLoadoutTimeline = {
  skillOrder: SkillLevelUp[];
  itemPurchases: ItemPurchase[];
  itemPurchaseGroups: ItemPurchaseGroup[];
};

/**
 * 귀환 여부는 구매 이벤트만으로 알 수 없다. 첫 구매부터 10초 이내의 거래만
 * 한 묶음으로 표시한다. 연속 구매 간격으로 묶으면 짧은 간격의 거래가 이어질 때
 * 서로 다른 시점까지 하나의 묶음으로 늘어날 수 있다.
 */
const RECALL_GAP_MS = 10_000;

export function groupItemPurchasesByRecall(
  itemPurchases: ItemPurchase[],
  gapMs = RECALL_GAP_MS,
): ItemPurchaseGroup[] {
  const groups: ItemPurchaseGroup[] = [];

  for (const purchase of [...itemPurchases].sort((a, b) => a.timestampMs - b.timestampMs)) {
    const lastGroup = groups.at(-1);
    const firstPurchase = lastGroup?.purchases[0];
    if (lastGroup && firstPurchase && purchase.timestampMs - firstPurchase.timestampMs <= gapMs) {
      lastGroup.purchases.push(purchase);
    } else {
      groups.push({ minute: purchase.minute, purchases: [purchase] });
    }
  }

  return groups;
}

function isAbilitySlot(slot: number | null): slot is 1 | 2 | 3 | 4 {
  return slot === 1 || slot === 2 || slot === 3 || slot === 4;
}

/** 세트 타임라인 이벤트에서 한 선수의 스킬 레벨업 순서와 아이템 구매 순서(판매 여부 포함)를 뽑아낸다. */
export function buildPlayerLoadoutTimeline(
  events: PlayerBuildEvent[],
  playerId: string,
): PlayerLoadoutTimeline {
  const playerEvents = events.filter((event) => event.playerId === playerId)
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const skillOrder: SkillLevelUp[] = playerEvents
    .filter((event) => event.eventType === "SKILL_LEVEL_UP" && event.levelUpType === "NORMAL" && isAbilitySlot(event.skillSlot))
    .map((event, index) => ({ level: index + 1, slot: event.skillSlot as 1 | 2 | 3 | 4 }));

  const itemPurchases: ItemPurchase[] = [];
  const unmatchedPurchaseIndexByItemId = new Map<number, number[]>();
  const soldPurchaseIndexByItemId = new Map<number, number[]>();
  const undonePurchaseIndexes = new Set<number>();

  for (const event of playerEvents) {
    if (event.eventType === "ITEM_PURCHASED" && event.itemId != null && event.itemId > 0) {
      const index = itemPurchases.length;
      itemPurchases.push({ itemId: event.itemId, timestampMs: event.timestampMs, minute: event.minute, sold: false });
      const queue = unmatchedPurchaseIndexByItemId.get(event.itemId) ?? [];
      queue.push(index);
      unmatchedPurchaseIndexByItemId.set(event.itemId, queue);
      continue;
    }

    if (event.eventType === "ITEM_SOLD" && event.itemId != null) {
      const queue = unmatchedPurchaseIndexByItemId.get(event.itemId);
      const matchIndex = queue?.shift();
      if (matchIndex != null) {
        itemPurchases[matchIndex].sold = true;
        const sold = soldPurchaseIndexByItemId.get(event.itemId) ?? [];
        sold.push(matchIndex);
        soldPurchaseIndexByItemId.set(event.itemId, sold);
      }
    }

    if (event.eventType === "ITEM_UNDO") {
      // 구매 취소는 beforeId, 판매 취소는 afterId에 대상이 들어온다.
      // 식별자가 0인 불완전한 원본은 다른 구매를 임의로 지우지 않는다.
      const beforeId = event.beforeItemId ?? event.itemId;
      if (beforeId != null && beforeId > 0) {
        const matchIndex = unmatchedPurchaseIndexByItemId.get(beforeId)?.pop();
        if (matchIndex != null) undonePurchaseIndexes.add(matchIndex);
      }
      const afterId = event.afterItemId;
      if (afterId != null && afterId > 0) {
        const matchIndex = soldPurchaseIndexByItemId.get(afterId)?.pop();
        if (matchIndex != null) {
          itemPurchases[matchIndex].sold = false;
          const queue = unmatchedPurchaseIndexByItemId.get(afterId) ?? [];
          queue.push(matchIndex);
          queue.sort((a, b) => a - b);
          unmatchedPurchaseIndexByItemId.set(afterId, queue);
        }
      }
    }
  }

  const retainedPurchases = itemPurchases.filter((_, index) => !undonePurchaseIndexes.has(index));
  return { skillOrder, itemPurchases: retainedPurchases, itemPurchaseGroups: groupItemPurchasesByRecall(retainedPurchases) };
}
