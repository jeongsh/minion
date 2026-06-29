export type GameSpell = {
  id: number;
  name: string;
  imageName: string;
};

type DdragonSummonerJson = {
  data: Record<
    string,
    {
      key: string;
      name: string;
      image: { full: string };
      modes?: string[];
    }
  >;
};

export function spellImageUrl(spell: Pick<GameSpell, "imageName">, version: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spell.imageName}`;
}

export function spellImageUrlById(spells: GameSpell[], spellId: number | null | undefined, version: string) {
  const spell = spells.find((entry) => entry.id === spellId);
  return spell ? spellImageUrl(spell, version) : "";
}

export function spellLabel(spells: GameSpell[], spellId: number | null | undefined) {
  if (!spellId) return "";
  return spells.find((entry) => entry.id === spellId)?.name ?? `#${spellId}`;
}

export function filterSpells(spells: GameSpell[], query: string, limit = 40) {
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? spells.filter(
        (spell) => spell.name.toLowerCase().includes(normalized) || String(spell.id).includes(normalized),
      )
    : spells;

  return filtered.slice(0, limit);
}

export async function fetchSpellCatalog(version = "16.12.1", locale = "ko_KR"): Promise<GameSpell[]> {
  const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/summoner.json`, {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    throw new Error(`Data Dragon summoner spell catalog request failed: ${response.status}`);
  }

  const json = (await response.json()) as DdragonSummonerJson;

  return Object.values(json.data)
    .filter((spell) => !spell.modes || spell.modes.includes("CLASSIC"))
    .map((spell) => ({
      id: Number(spell.key),
      name: spell.name,
      imageName: spell.image.full,
    }))
    .filter((spell) => Number.isFinite(spell.id) && spell.id > 0 && spell.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
