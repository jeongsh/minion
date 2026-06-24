import type { Champion, PlayerStatLine, SetPickBan, SetResult } from "@/lib/types";

export type ChampionRankingMode = "combined" | "ban" | "pick";

export type ChampionRankingRow = {
  rank: number;
  champion: Champion;
  position: string;
  pickCount: number;
  banCount: number;
  totalCount: number;
  pickRate: number | null;
  banRate: number | null;
  pickBanRate: number | null;
};

function dominantPosition(
  championId: string,
  positionCounts: Map<string, Map<string, number>>,
) {
  const byPosition = positionCounts.get(championId);
  if (!byPosition || byPosition.size === 0) {
    return "-";
  }

  return [...byPosition.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function buildPositionCounts(statLines: PlayerStatLine[]) {
  const positionCounts = new Map<string, Map<string, number>>();

  for (const line of statLines) {
    if (!line.championId) continue;

    const byPosition = positionCounts.get(line.championId) ?? new Map<string, number>();
    byPosition.set(line.position, (byPosition.get(line.position) ?? 0) + 1);
    positionCounts.set(line.championId, byPosition);
  }

  return positionCounts;
}

export function buildChampionRankings(
  picksBans: SetPickBan[],
  sets: SetResult[],
  champions: Champion[],
  statLines: PlayerStatLine[],
  mode: ChampionRankingMode,
): ChampionRankingRow[] {
  const totalSets = sets.length;
  const championMap = new Map(champions.map((champion) => [champion.id, champion]));
  const positionCounts = buildPositionCounts(statLines);
  const counts = new Map<string, { pickCount: number; banCount: number }>();

  for (const item of picksBans) {
    if (!item.championId) continue;

    const current = counts.get(item.championId) ?? { pickCount: 0, banCount: 0 };

    if (item.actionType === "pick") {
      current.pickCount += 1;
    } else if (item.actionType === "ban") {
      current.banCount += 1;
    }

    counts.set(item.championId, current);
  }

  return [...counts.entries()]
    .map(([championId, count]) => {
      const champion = championMap.get(championId);
      if (!champion) return null;

      const totalCount = count.pickCount + count.banCount;

      return {
        champion,
        position: dominantPosition(championId, positionCounts),
        pickCount: count.pickCount,
        banCount: count.banCount,
        totalCount,
        pickRate: totalSets === 0 ? null : (count.pickCount / totalSets) * 100,
        banRate: totalSets === 0 ? null : (count.banCount / totalSets) * 100,
        pickBanRate: totalSets === 0 ? null : (totalCount / totalSets) * 100,
      };
    })
    .filter((row): row is Omit<ChampionRankingRow, "rank"> => row !== null)
    .filter((row) => {
      if (mode === "pick") return row.pickCount > 0;
      if (mode === "ban") return row.banCount > 0;
      return row.totalCount > 0;
    })
    .sort((a, b) => {
      if (mode === "pick") {
        return (
          b.pickCount - a.pickCount ||
          b.banCount - a.banCount ||
          a.champion.name.localeCompare(b.champion.name, "ko")
        );
      }

      if (mode === "ban") {
        return (
          b.banCount - a.banCount ||
          b.pickCount - a.pickCount ||
          a.champion.name.localeCompare(b.champion.name, "ko")
        );
      }

      return (
        b.totalCount - a.totalCount ||
        b.pickCount - a.pickCount ||
        b.banCount - a.banCount ||
        a.champion.name.localeCompare(b.champion.name, "ko")
      );
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
