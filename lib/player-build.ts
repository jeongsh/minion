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
 * 라이엇 타임라인에는 "귀환" 자체를 나타내는 이벤트가 없다. 상점 구매는 사실상 기지에서만
 * 가능하므로, 연속 구매 사이 간격이 이 값보다 벌어지면 다른 귀환(또는 시작 구매)으로 간주한다.
 * 실전에서 라인 복귀까지 걸리는 시간을 감안해 60초로 잡았다.
 */
const RECALL_GAP_MS = 60_000;

export function groupItemPurchasesByRecall(
  itemPurchases: ItemPurchase[],
  gapMs = RECALL_GAP_MS,
): ItemPurchaseGroup[] {
  const groups: ItemPurchaseGroup[] = [];

  for (const purchase of itemPurchases) {
    const lastGroup = groups.at(-1);
    const lastPurchase = lastGroup?.purchases.at(-1);
    if (lastGroup && lastPurchase && purchase.timestampMs - lastPurchase.timestampMs <= gapMs) {
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
  const playerEvents = events.filter((event) => event.playerId === playerId);

  const skillOrder: SkillLevelUp[] = playerEvents
    .filter((event) => event.eventType === "SKILL_LEVEL_UP" && event.levelUpType === "NORMAL" && isAbilitySlot(event.skillSlot))
    .map((event, index) => ({ level: index + 1, slot: event.skillSlot as 1 | 2 | 3 | 4 }));

  const itemPurchases: ItemPurchase[] = [];
  const unmatchedPurchaseIndexByItemId = new Map<number, number[]>();

  for (const event of playerEvents) {
    if (event.eventType === "ITEM_PURCHASED" && event.itemId != null) {
      const index = itemPurchases.length;
      itemPurchases.push({ itemId: event.itemId, timestampMs: event.timestampMs, minute: event.minute, sold: false });
      const queue = unmatchedPurchaseIndexByItemId.get(event.itemId) ?? [];
      queue.push(index);
      unmatchedPurchaseIndexByItemId.set(event.itemId, queue);
      continue;
    }

    if ((event.eventType === "ITEM_SOLD" || event.eventType === "ITEM_UNDO") && event.itemId != null) {
      const queue = unmatchedPurchaseIndexByItemId.get(event.itemId);
      const matchIndex = queue?.shift();
      if (matchIndex != null) itemPurchases[matchIndex].sold = true;
    }
  }

  return { skillOrder, itemPurchases, itemPurchaseGroups: groupItemPurchasesByRecall(itemPurchases) };
}
