export type GameRuneOption = {
  id: number;
  name: string;
  icon: string;
  treeName?: string;
};

export type RuneCatalog = {
  keystones: GameRuneOption[];
  trees: GameRuneOption[];
};

type DdragonRuneSlot = {
  runes: Array<{
    id: number;
    name: string;
    icon: string;
  }>;
};

type DdragonRuneTree = {
  id: number;
  name: string;
  icon: string;
  slots: DdragonRuneSlot[];
};

export function runeImageUrl(rune: Pick<GameRuneOption, "icon">) {
  return `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`;
}

export function runeImageUrlById(options: GameRuneOption[], runeId: number | null | undefined) {
  const rune = options.find((entry) => entry.id === runeId);
  return rune ? runeImageUrl(rune) : "";
}

export function runeLabel(options: GameRuneOption[], runeId: number | null | undefined) {
  if (!runeId) return "";
  return options.find((entry) => entry.id === runeId)?.name ?? `#${runeId}`;
}

export function filterRunes(options: GameRuneOption[], query: string, limit = 40) {
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? options.filter(
        (rune) =>
          rune.name.toLowerCase().includes(normalized) ||
          rune.treeName?.toLowerCase().includes(normalized) ||
          String(rune.id).includes(normalized),
      )
    : options;

  return filtered.slice(0, limit);
}

export async function fetchRuneCatalog(version = "16.12.1"): Promise<RuneCatalog> {
  const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/runesReforged.json`, {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    throw new Error(`Data Dragon rune catalog request failed: ${response.status}`);
  }

  const json = (await response.json()) as DdragonRuneTree[];

  const trees = json
    .map((tree) => ({
      id: tree.id,
      name: tree.name,
      icon: tree.icon,
    }))
    .filter((tree) => Number.isFinite(tree.id) && tree.id > 0 && tree.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const keystones = json
    .flatMap((tree) =>
      (tree.slots[0]?.runes ?? []).map((rune) => ({
        id: rune.id,
        name: rune.name,
        icon: rune.icon,
        treeName: tree.name,
      })),
    )
    .filter((rune) => Number.isFinite(rune.id) && rune.id > 0 && rune.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return { keystones, trees };
}

export async function fetchRuneImages(version = "16.12.1"): Promise<Record<string, string>> {
  try {
    const response = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/runesReforged.json`,
      { next: { revalidate: 60 * 60 * 24 } },
    );
    if (!response.ok) return {};
    const data = (await response.json()) as DdragonRuneTree[];
    const result: Record<string, string> = {};
    for (const style of data) {
      result[String(style.id)] = `https://ddragon.leagueoflegends.com/cdn/img/${style.icon}`;
      for (const slot of style.slots) {
        for (const rune of slot.runes) {
          result[String(rune.id)] = `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`;
        }
      }
    }
    return result;
  } catch {
    return {};
  }
}
