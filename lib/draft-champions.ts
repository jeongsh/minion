import { pickerChampions } from "@/lib/champions";
import type { Champion, PlayerStatLine, SetPickBan } from "@/lib/types";

export function draftEditorChampions(
  champions: Champion[],
  picksBans: SetPickBan[],
  playerStatLines: PlayerStatLine[] = [],
) {
  const merged = pickerChampions(champions);
  const knownIds = new Set(merged.map((champion) => champion.id));

  for (const championId of [
    ...picksBans.map((item) => item.championId),
    ...playerStatLines.map((line) => line.championId),
  ]) {
    if (!championId || knownIds.has(championId)) {
      continue;
    }

    const champion = champions.find((entry) => entry.id === championId);
    if (champion) {
      merged.push(champion);
      knownIds.add(championId);
    }
  }

  return merged;
}
