import "server-only";

import { unstable_cache } from "next/cache";
import { buildChampionDirectoryFromAggregates, CHAMPION_POSITIONS } from "@/lib/champion-analysis";
import { championArtwork, championImage, championLabel } from "@/lib/champions";
import { ddragonVersionFromPatch } from "@/lib/ddragon";
import { fetchDetailedItemCatalog, itemImageUrl } from "@/lib/items";
import { getPlayerStatLines } from "@/lib/data/lck";
import { CHAMPION_PAGE_DATA_TAG, getChampionDirectoryStats, getChampionPageReferenceData, resolveChampionScope } from "@/lib/data/champion-page";
import { dateKeyKST } from "@/lib/view-data";

export type HomeInsights = {
  tournament: string;
  date: string;
  patches: string[];
  setCount: number;
  href: string;
  champions: { id: string; name: string; image: string; artwork: string; href: string; picks: number; bans: number; presence: number | null; winRate: number | null; games: number }[];
  builds: { id: string; player: string; playerImage: string; team: string; position: string; champion: string; image: string; artwork: string; matchup: string; date: string; setNumber: number; patch: string | null; won: boolean; href: string; items: { name: string; image: string }[] }[];
};

const empty: HomeInsights = { tournament: "", date: "", patches: [], setCount: 0, href: "/champions", champions: [], builds: [] };

export const getHomeInsights = unstable_cache(async (): Promise<HomeInsights> => {
  const data = await getChampionPageReferenceData();
  const completedSets = data.sets.filter((set) => (set.status === "finished" || set.status === "data_synced") && set.winnerTeamId);
  const recordedMatchIds = new Set(completedSets.map((set) => set.matchId));
  const latestMatch = data.matches
    .filter((match) => match.status === "completed" && recordedMatchIds.has(match.id))
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate) || a.id.localeCompare(b.id))[0];
  const tournament = data.tournaments.find((item) => item.id === latestMatch?.tournamentId);
  if (!latestMatch || !tournament) return empty;

  const scope = resolveChampionScope({ ...data, sets: completedSets }, { season: tournament.season, tournament: tournament.id });
  const scopeIds = new Set(scope.setIds);
  const matchMap = new Map(data.matches.map((match) => [match.id, match]));
  const recentSets = completedSets.filter((set) => scopeIds.has(set.id))
    .sort((a, b) => (matchMap.get(b.matchId)?.matchDate ?? "").localeCompare(matchMap.get(a.matchId)?.matchDate ?? "") || b.setNumber - a.setNumber)
    .slice(0, 10);
  const [aggregates, lines] = await Promise.all([
    getChampionDirectoryStats(scope.setIds),
    getPlayerStatLines(recentSets.map((set) => set.id)),
  ]);
  const query = new URLSearchParams({ season: String(scope.season), tournament: scope.tournament });
  const rows = buildChampionDirectoryFromAggregates(data.champions, aggregates)
    .filter((row) => row.draft.picks + row.draft.bans > 0)
    .sort((a, b) => (b.draft.presenceRate ?? -1) - (a.draft.presenceRate ?? -1) || b.draft.picks - a.draft.picks || a.champion.id.localeCompare(b.champion.id))
    .slice(0, 6);
  const players = new Map(data.players.map((player) => [player.id, player]));
  const champions = new Map(data.champions.map((champion) => [champion.id, champion]));
  const teams = new Map(data.teams.map((team) => [team.id, team.shortName]));
  const builds: HomeInsights["builds"] = [];
  // Keep the five role cards, then add the next available recent player build.
  for (const position of [...CHAMPION_POSITIONS, null]) {
    for (const set of recentSets) {
      const line = lines.filter((item) => item.setId === set.id && (!position || item.position === position) && !builds.some(build => build.id === `${set.id}:${item.playerId}`) && players.has(item.playerId) && champions.has(item.championId ?? "") && item.itemIds.slice(0, 6).some((id) => id && id > 0))
        .sort((a, b) => Number(b.teamId === set.winnerTeamId) - Number(a.teamId === set.winnerTeamId) || a.playerId.localeCompare(b.playerId))[0];
      const match = matchMap.get(set.matchId);
      if (!line || !match) continue;
      const champion = champions.get(line.championId!)!;
      const version = ddragonVersionFromPatch(set.patch);
      builds.push({
        id: `${set.id}:${line.playerId}`, player: players.get(line.playerId)!.name, position: line.position,
        playerImage: players.get(line.playerId)!.profileImageUrl, team: teams.get(line.teamId) ?? "",
        champion: championLabel(champion), image: championImage(champion), artwork: championArtwork(champion),
        matchup: `${teams.get(match.teamAId) ?? "TBD"} vs ${teams.get(match.teamBId) ?? "TBD"}`,
        date: dateKeyKST(match.matchDate), setNumber: set.setNumber, patch: set.patch ?? null,
        won: line.teamId === set.winnerTeamId,
        href: `/matches/${match.id}?tab=data&set=${set.id}&player=${line.playerId}#player-build-title`,
        items: line.itemIds.slice(0, 6).filter((id): id is number => !!id && id > 0).map((id) => ({ name: `아이템 ${id}`, image: itemImageUrl(id, version) })),
      });
      break;
    }
  }
  // Catalog failures must not hide match records; retain readable item IDs.
  const versions = [...new Set(builds.map((build) => ddragonVersionFromPatch(build.patch)))];
  const catalogs = new Map(await Promise.all(versions.map(async (version) => [version, await fetchDetailedItemCatalog(version).catch(() => [])] as const)));
  for (const build of builds) {
    const catalog = catalogs.get(ddragonVersionFromPatch(build.patch)) ?? [];
    for (const item of build.items) {
      const id = Number(item.name.replace("아이템 ", ""));
      item.name = catalog.find((entry) => entry.id === id)?.name ?? item.name;
    }
  }
  return {
    tournament: tournament.name, date: dateKeyKST(latestMatch.matchDate), patches: scope.options.patches,
    setCount: scope.counts.sets, href: `/champions?${query}`,
    champions: rows.map((row) => ({ id: row.champion.id, name: championLabel(row.champion), image: championImage(row.champion), artwork: championArtwork(row.champion), href: `/champions/${row.champion.slug}?${query}`, picks: row.draft.picks, bans: row.draft.bans, presence: row.draft.presenceRate, winRate: row.record.winRate, games: row.record.games })),
    builds,
  };
}, ["home-insights-artwork-six-v2"], { revalidate: 300, tags: [CHAMPION_PAGE_DATA_TAG, "home-public-data"] });
