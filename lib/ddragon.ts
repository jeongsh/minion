export const DEFAULT_DDRAGON_VERSION = "16.12.1";

export function ddragonVersionFromPatch(patch: string | null | undefined) {
  const normalized = String(patch ?? "").trim();
  const splitSeasonMatch = normalized.match(/^(\d{2})\.S\d+\.(\d{1,2})$/i);
  if (splitSeasonMatch) {
    const season = Number(splitSeasonMatch[1]);
    const patchNumber = Number(splitSeasonMatch[2]);
    if (!Number.isFinite(season) || !Number.isFinite(patchNumber)) return DEFAULT_DDRAGON_VERSION;

    return `${season - 10}.${patchNumber}.1`;
  }

  const match = normalized.match(/^(\d{2})\.(\d{1,2})$/);

  if (!match) return DEFAULT_DDRAGON_VERSION;

  const season = Number(match[1]);
  const patchNumber = Number(match[2]);
  if (!Number.isFinite(season) || !Number.isFinite(patchNumber)) return DEFAULT_DDRAGON_VERSION;

  const ddragonSeason = season >= 20 ? season - 10 : season;
  return `${ddragonSeason}.${patchNumber}.1`;
}

export function uniqueDdragonVersionsForPatches(patches: Array<string | null | undefined>) {
  return [...new Set(patches.map(ddragonVersionFromPatch))];
}
