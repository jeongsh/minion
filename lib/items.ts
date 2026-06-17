export type GameItem = {
  id: number;
  name: string;
};

type DdragonItemJson = {
  data: Record<string, { name: string }>;
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

export async function fetchItemCatalog(version = "16.12.1"): Promise<GameItem[]> {
  const response = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/item.json`,
    { next: { revalidate: 60 * 60 * 24 } },
  );

  if (!response.ok) {
    throw new Error(`Data Dragon item catalog request failed: ${response.status}`);
  }

  const json = (await response.json()) as DdragonItemJson;

  return Object.entries(json.data)
    .map(([id, item]) => ({ id: Number(id), name: item.name }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
