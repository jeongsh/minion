export type GameItem = {
  id: number;
  name: string;
};

type DdragonItemJson = {
  data: Record<string, {
    name: string;
    maps?: Record<string, boolean>;
    from?: string[];
    into?: string[];
    tags?: string[];
    purchasable?: boolean;
    gold?: { base?: number; total?: number; sell?: number; purchasable?: boolean };
  }>;
};

type DdragonItemEntry = {
  id: number;
  name: string;
  maps?: Record<string, boolean>;
};

export function itemImageUrl(itemId: number, version: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
}

export function itemLabel(items: GameItem[], itemId: number | null | undefined) {
  if (!itemId) return "";
  return items.find((item) => item.id === itemId)?.name ?? `#${itemId}`;
}

export function filterItems(items: GameItem[], query: string, limit = 40) {
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? items.filter(
        (item) => item.name.toLowerCase().includes(normalized) || String(item.id).includes(normalized),
      )
    : items;

  return filtered.slice(0, limit);
}

function itemPreference(item: DdragonItemEntry) {
  const isSummonersRift = item.maps?.["11"] === true;
  const isModeVariant = item.id >= 100000;

  return [
    isSummonersRift ? 0 : 1,
    isModeVariant ? 1 : 0,
    item.id,
  ] as const;
}

function compareItemPreference(a: DdragonItemEntry, b: DdragonItemEntry) {
  const left = itemPreference(a);
  const right = itemPreference(b);

  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }

  return 0;
}

export function preferSummonersRiftItems(items: DdragonItemEntry[]): GameItem[] {
  const byName = new Map<string, DdragonItemEntry>();

  for (const item of items) {
    if (!Number.isFinite(item.id) || item.id <= 0 || item.name.length === 0) continue;

    const key = item.name.toLowerCase();
    const current = byName.get(key);
    if (!current || compareItemPreference(item, current) < 0) {
      byName.set(key, item);
    }
  }

  return [...byName.values()]
    .map((item) => ({ id: item.id, name: item.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export async function fetchItemCatalog(version = "16.12.1", locale = "ko_KR"): Promise<GameItem[]> {
  const response = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/item.json`,
    { next: { revalidate: 60 * 60 * 24 } },
  );

  if (!response.ok) {
    throw new Error(`Data Dragon item catalog request failed: ${response.status}`);
  }

  const json = (await response.json()) as DdragonItemJson;

  return preferSummonersRiftItems(
    Object.entries(json.data).map(([id, item]) => ({
      id: Number(id),
      name: item.name,
      maps: item.maps,
    })),
  );
}

export type DetailedGameItem = GameItem & {
  from: number[];
  into: number[];
  tags: string[];
  purchasable: boolean;
  totalGold: number;
  maps: Record<string, boolean>;
};

/** 구매 이벤트 집계용 상세 카탈로그. 완성 아이템과 재료·소모품을 구분할 때 사용한다. */
export async function fetchDetailedItemCatalog(
  version = "16.12.1",
  locale = "ko_KR",
): Promise<DetailedGameItem[]> {
  const response = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/item.json`,
    { next: { revalidate: 60 * 60 * 24 } },
  );

  if (!response.ok) {
    throw new Error(`Data Dragon item catalog request failed: ${response.status}`);
  }

  const json = (await response.json()) as DdragonItemJson;
  return Object.entries(json.data)
    .map(([id, item]) => ({
      id: Number(id),
      name: item.name,
      from: (item.from ?? []).map(Number).filter(Number.isFinite),
      into: (item.into ?? []).map(Number).filter(Number.isFinite),
      tags: item.tags ?? [],
      purchasable: item.purchasable !== false && item.gold?.purchasable !== false,
      totalGold: item.gold?.total ?? 0,
      maps: item.maps ?? {},
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.name.length > 0);
}

/** 프로 경기 구매 기록에서 첫 코어/완성 아이템 후보로 셀 수 있는지 판별한다. */
export function isCompletedCompetitiveItem(item: DetailedGameItem | undefined) {
  if (!item || !item.purchasable || item.maps["11"] === false) return false;
  // Tier-two boots can lead into role upgrades in newer seasons. They remain a
  // meaningful completed purchase in an observed build path even when `into` is set.
  if ((item.into.length > 0 && !item.tags.includes("Boots")) || item.totalGold < 900) return false;
  if (item.tags.includes("Consumable") || item.tags.includes("Trinket")) return false;
  return true;
}
