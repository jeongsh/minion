import type {
  MobileChampionBuild,
  MobileChampionDetailDto,
  MobileChampionDirectoryItem,
  MobileChampionItem,
  MobileChampionItemSequence,
  MobileChampionPosition,
  MobileChampionRuneColumn,
  MobileChampionRuneOption,
  MobileChampionScope,
  MobileChampionSummary,
  MobileChampionsDto,
  MobilePlayerSummary,
} from "@/packages/contracts/src/mobile-v1";
import {
  buildChampionAnalysis,
  buildChampionDirectory,
  buildChampionOverview,
  buildCompletedItemSequenceSummaries,
  type ChampionAnalysis,
  type CompletedItemSequenceSummary,
} from "@/lib/champion-analysis";
import {
  championImage,
  championSearchText,
  fetchChampionAbilityIcons,
  normalizedDdragonId,
} from "@/lib/champions";
import {
  getChampionBySlug,
  getChampionDetailData,
  getChampionDirectoryData,
  getChampionPageReferenceData,
  resolveChampionScope,
  type ChampionScopeInput,
} from "@/lib/data/champion-page";
import {
  DEFAULT_DDRAGON_VERSION,
  ddragonVersionFromPatch,
  uniqueDdragonVersionsForPatches,
} from "@/lib/ddragon";
import {
  fetchDetailedItemCatalog,
  isCompletedCompetitiveItem,
  itemImageUrl,
  type DetailedGameItem,
} from "@/lib/items";
import { toMobileTeam } from "@/lib/mobile/api-response";
import { buildRuneBuildGrid, fetchFullRuneTrees } from "@/lib/runes";
import { fetchSpellCatalog, spellImageUrlById, spellLabel } from "@/lib/spells";
import type { Champion, Player, PlayerPosition, Team } from "@/lib/types";

const POSITIONS = new Set<MobileChampionPosition>(["TOP", "JGL", "MID", "BOT", "SUP"]);
const SORTS = new Set<MobileChampionsDto["selected"]["sort"]>(["presence", "picks", "bans", "winRate", "name"]);
const POSITION_LABEL: Record<MobileChampionPosition, string> = {
  TOP: "탑",
  JGL: "정글",
  MID: "미드",
  BOT: "바텀",
  SUP: "서포터",
};

function image(url?: string | null) {
  return url ? { url } : null;
}

function toChampion(champion: Champion | null | undefined): MobileChampionSummary | null {
  return champion ? { id: champion.id, slug: champion.slug, name: champion.name, image: image(championImage(champion)) } : null;
}

function toPlayer(player: Player | null | undefined): MobilePlayerSummary | null {
  return player ? {
    id: player.id,
    slug: player.slug,
    name: player.name,
    position: player.position,
    teamId: player.teamId || null,
    profileImage: image(player.profileImageUrl),
  } : null;
}

function scopeDto(scope: ReturnType<typeof resolveChampionScope>): MobileChampionScope {
  return {
    season: scope.season,
    tournament: scope.tournament,
    patch: scope.patch,
    seasons: scope.options.seasons,
    tournaments: scope.options.tournaments.map((option) => ({ value: option.key, label: option.name })),
    patches: scope.options.patches,
  };
}

function scopeInput(searchParams: URLSearchParams): ChampionScopeInput {
  return {
    season: searchParams.get("season"),
    tournament: searchParams.get("tournament"),
    patch: searchParams.get("patch"),
  };
}

export async function getMobileChampions(searchParams: URLSearchParams): Promise<MobileChampionsDto> {
  const references = await getChampionPageReferenceData();
  const scope = resolveChampionScope(references, scopeInput(searchParams));
  const data = await getChampionDirectoryData(scope.setIds);
  const requestedPosition = searchParams.get("position");
  const position = POSITIONS.has(requestedPosition as MobileChampionPosition)
    ? requestedPosition as MobileChampionPosition
    : "all";
  const query = (searchParams.get("q") ?? "").trim();
  const requestedSort = searchParams.get("sort");
  const sort = SORTS.has(requestedSort as MobileChampionsDto["selected"]["sort"])
    ? requestedSort as MobileChampionsDto["selected"]["sort"]
    : "presence";
  const normalizedQuery = query.toLocaleLowerCase("ko-KR");

  const rows = buildChampionDirectory(data)
    .filter((row) => row.draft.picks > 0 || row.draft.bans > 0)
    .filter((row) => position === "all" || row.positions.some((entry) => entry.position === position && entry.picks > 0))
    .filter((row) => !normalizedQuery || championSearchText(row.champion).toLocaleLowerCase("ko-KR").includes(normalizedQuery))
    .sort((left, right) => {
      if (sort === "picks") return right.draft.picks - left.draft.picks || right.draft.bans - left.draft.bans;
      if (sort === "bans") return right.draft.bans - left.draft.bans || right.draft.picks - left.draft.picks;
      if (sort === "winRate") return (right.record.winRate ?? -1) - (left.record.winRate ?? -1) || right.record.games - left.record.games;
      if (sort === "name") return left.champion.name.localeCompare(right.champion.name, "ko");
      return (right.draft.presenceRate ?? -1) - (left.draft.presenceRate ?? -1) || right.draft.picks - left.draft.picks;
    });

  const items: MobileChampionDirectoryItem[] = rows.map((row) => ({
    ...toChampion(row.champion)!,
    picks: row.draft.picks,
    bans: row.draft.bans,
    presenceRate: row.draft.presenceRate,
    winRate: row.record.winRate,
    positions: row.positions.filter((entry) => entry.picks > 0).map((entry) => entry.position),
  }));

  return { schemaVersion: 1, items, scope: scopeDto(scope), selected: { position, query, sort } };
}

async function readCatalog<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

async function loadDetailedItems(versions: string[]) {
  const rows = await Promise.all([...new Set(versions)].map(async (version) => ({
    version,
    items: await readCatalog(() => fetchDetailedItemCatalog(version), [] as DetailedGameItem[]),
  })));
  return {
    byVersion: new Map(rows.map((row) => [row.version, new Map(row.items.map((item) => [item.id, item]))])),
    versionById: new Map(rows.flatMap((row) => row.items.map((item) => [item.id, row.version] as const))),
    nameById: new Map(rows.flatMap((row) => row.items.map((item) => [item.id, item.name] as const))),
  };
}

function compactTournamentLabel(value: string | null) {
  const name = value?.trim();
  if (!name) return "대회";
  const normalized = name.toUpperCase();
  const known: Array<[RegExp, string]> = [
    [/\bLCK\s*(?:CHALLENGERS|CL)\b/, "LCK CL"], [/\bLCK\b/, "LCK"], [/KESPA/, "KeSPA"],
    [/\bMSI\b|MID[- ]SEASON INVITATIONAL/, "MSI"], [/\bWORLDS?\b|WORLD CHAMPIONSHIP/, "Worlds"],
    [/\bEWC\b|ESPORTS WORLD CUP/, "EWC"], [/\bLEC\b/, "LEC"], [/\bLPL\b/, "LPL"],
  ];
  return known.find(([pattern]) => pattern.test(normalized))?.[1]
    ?? (name.replace(/\b20\d{2}\b.*$/i, "").replace(/\b(?:spring|summer|split|season|rounds?|playoffs?).*$/i, "").trim() || name);
}

function buildStartingItems(
  analysis: ChampionAnalysis,
  isStartingItem: (itemId: number, context: { setId: string; playerId: string }) => boolean,
): CompletedItemSequenceSummary[] {
  const gameByKey = new Map(analysis.games.map((game) => [`${game.setId}:${game.playerId}`, game]));
  const observed: Array<{ ids: number[]; result: "W" | "L" | null }> = [];
  for (const sequence of analysis.loadouts.gamePurchaseSequences) {
    const first = sequence.purchases[0];
    if (!first) continue;
    const context = { setId: sequence.setId, playerId: sequence.playerId };
    const ids = sequence.purchases
      .filter((purchase) => purchase.timestampMs - first.timestampMs <= 60_000)
      .map((purchase) => purchase.itemId)
      .filter((id) => isStartingItem(id, context))
      .sort((a, b) => a - b);
    if (ids.length) observed.push({ ids, result: gameByKey.get(`${sequence.setId}:${sequence.playerId}`)?.result ?? null });
  }
  const groups = new Map<string, typeof observed>();
  for (const row of observed) groups.set(row.ids.join(","), [...(groups.get(row.ids.join(",")) ?? []), row]);
  return [...groups.values()].map((group) => {
    const wins = group.filter((row) => row.result === "W").length;
    const losses = group.filter((row) => row.result === "L").length;
    return {
      ids: group[0].ids,
      averageMinutes: group[0].ids.map(() => 0),
      games: group.length,
      eligibleGames: observed.length,
      wins,
      losses,
      winRate: wins + losses ? wins / (wins + losses) * 100 : 0,
      selectionRate: observed.length ? group.length / observed.length * 100 : 0,
    };
  }).sort((a, b) => b.games - a.games || b.wins - a.wins);
}

function buildDepthItems(sequences: CompletedItemSequenceSummary[], depth: number) {
  const groups = new Map<number, { id: number; games: number; wins: number; losses: number }>();
  for (const sequence of sequences) {
    const id = sequence.ids[depth - 1];
    if (!id) continue;
    const current = groups.get(id) ?? { id, games: 0, wins: 0, losses: 0 };
    current.games += sequence.games;
    current.wins += sequence.wins;
    current.losses += sequence.losses;
    groups.set(id, current);
  }
  return [...groups.values()].sort((a, b) => b.games - a.games || b.wins - a.wins).slice(0, 5);
}

function runeOption(option: { name: string; url: string; selected: boolean }): MobileChampionRuneOption {
  return { name: option.name, image: image(option.url), selected: option.selected };
}

function runeColumn(name: string, icon: string, rows: Array<Array<{ name: string; url: string; selected: boolean }>>): MobileChampionRuneColumn {
  return { name, image: image(icon), rows: rows.map((row) => row.map(runeOption)) };
}

function itemSequence(
  sequence: CompletedItemSequenceSummary,
  versionById: Map<number, string>,
  nameById: Map<number, string>,
): MobileChampionItemSequence {
  return {
    games: sequence.games,
    winRate: sequence.winRate,
    selectionRate: sequence.selectionRate,
    items: sequence.ids.map((id, index) => ({
      id,
      name: nameById.get(id) ?? `#${id}`,
      image: image(itemImageUrl(id, versionById.get(id) ?? DEFAULT_DDRAGON_VERSION)),
      minute: sequence.averageMinutes[index] ?? null,
    })),
  };
}

function itemPreference(
  row: { id: number; games: number; wins: number; losses: number; winRate: number; selectionRate?: number },
  versionById: Map<number, string>,
  nameById: Map<number, string>,
): MobileChampionItem {
  return {
    id: row.id,
    name: nameById.get(row.id) ?? `#${row.id}`,
    image: image(itemImageUrl(row.id, versionById.get(row.id) ?? DEFAULT_DDRAGON_VERSION)),
    games: row.games,
    winRate: row.winRate,
    selectionRate: row.selectionRate ?? 0,
  };
}

function teamForPlayer(player: Player | null, teams: Team[]) {
  const team = player ? teams.find((row) => row.id === player.teamId) : null;
  return team ? toMobileTeam(team) : null;
}

async function buildMobileBuild(analysis: ChampionAnalysis, champion: Champion, representativePatch: string | null | undefined): Promise<MobileChampionBuild> {
  const version = ddragonVersionFromPatch(representativePatch) || DEFAULT_DDRAGON_VERSION;
  const versions = uniqueDdragonVersionsForPatches([representativePatch, ...analysis.games.map((game) => game.patch)]);
  const [catalog, spells, runeTrees, abilityIcons] = await Promise.all([
    loadDetailedItems(versions),
    readCatalog(() => fetchSpellCatalog(version), []),
    readCatalog(() => fetchFullRuneTrees(version), []),
    readCatalog(() => fetchChampionAbilityIcons(normalizedDdragonId(champion), version), null),
  ]);
  const gameVersion = new Map(analysis.games.map((game) => [`${game.setId}:${game.playerId}`, ddragonVersionFromPatch(game.patch)]));
  const detailFor = (id: number, context: { setId: string; playerId: string }) => catalog.byVersion.get(gameVersion.get(`${context.setId}:${context.playerId}`) ?? "")?.get(id);
  const isCore = (id: number, context: { setId: string; playerId: string }) => {
    const detail = detailFor(id, context);
    return Boolean(detail && !detail.tags.includes("Boots") && !detail.tags.includes("Trinket") && isCompletedCompetitiveItem(detail));
  };
  const core = new Map([3, 4, 5, 6].map((count) => [count, buildCompletedItemSequenceSummaries({
    sequences: analysis.loadouts.gamePurchaseSequences,
    games: analysis.games,
    minItems: count,
    maxItems: count,
    isCompletedItem: isCore,
  })]));
  const starting = buildStartingItems(analysis, (id, context) => {
    const detail = detailFor(id, context);
    return Boolean(detail && !detail.tags.includes("Trinket"));
  });
  const allDetails = new Map<number, DetailedGameItem>();
  for (const items of catalog.byVersion.values()) for (const [id, detail] of items) allDetails.set(id, detail);
  const boots = [...new Map([...analysis.loadouts.finalItems, ...analysis.loadouts.roleBoundItems]
    .filter((row) => allDetails.get(row.id)?.tags.includes("Boots"))
    .sort((a, b) => b.games - a.games)
    .map((row) => [row.id, row])).values()].slice(0, 3);
  const rune = analysis.loadouts.fullRunePages[0];
  const grid = rune ? buildRuneBuildGrid(rune.names, runeTrees) : null;
  const skill = analysis.loadouts.skillOrders[0];
  const depth = (count: number) => buildDepthItems(core.get(count) ?? [], count).map((row) => itemPreference({
    ...row,
    winRate: row.wins + row.losses ? row.wins / (row.wins + row.losses) * 100 : 0,
  }, catalog.versionById, catalog.nameById));

  return {
    runes: {
      primary: grid ? runeColumn(grid.primaryTreeName, grid.primaryTreeIcon, grid.primaryRows) : null,
      secondary: grid ? runeColumn(grid.secondaryTreeName, grid.secondaryTreeIcon, grid.secondaryRows) : null,
      shards: grid ? grid.shardRows.map((row) => row.map(runeOption)) : [],
    },
    spells: analysis.loadouts.spellCombinations.slice(0, 2).map((combo) => ({
      games: combo.games,
      winRate: combo.winRate,
      selectionRate: combo.selectionRate,
      items: combo.ids.map((id) => ({ id, name: spellLabel(spells, id), image: image(spellImageUrlById(spells, id, version)) })),
    })),
    skill: skill ? {
      games: skill.games,
      winRate: skill.winRate,
      selectionRate: skill.selectionRate,
      order: skill.ids.slice(0, 18),
      icons: Object.fromEntries([1, 2, 3, 4].map((slot) => [String(slot), image(abilityIcons?.[slot as 1 | 2 | 3 | 4])])),
    } : null,
    startingItems: starting.slice(0, 2).map((row) => itemSequence(row, catalog.versionById, catalog.nameById)),
    boots: boots.map((row) => itemPreference(row, catalog.versionById, catalog.nameById)),
    trinkets: analysis.loadouts.trinkets.slice(0, 3).map((row) => itemPreference(row, catalog.versionById, catalog.nameById)),
    core3: (core.get(3) ?? []).slice(0, 3).map((row) => itemSequence(row, catalog.versionById, catalog.nameById)),
    core4: depth(4),
    core5: depth(5),
    core6: depth(6),
  };
}

export async function getMobileChampionDetail(championSlug: string, searchParams: URLSearchParams): Promise<MobileChampionDetailDto | null> {
  const [champion, references] = await Promise.all([getChampionBySlug(championSlug), getChampionPageReferenceData()]);
  if (!champion) return null;
  const scope = resolveChampionScope(references, scopeInput(searchParams));
  const data = await getChampionDetailData(champion.id, scope.setIds);
  const defaultOverview = buildChampionOverview(data, champion.id);
  const requested = searchParams.get("position");
  const requestedPosition = POSITIONS.has(requested as MobileChampionPosition) ? requested as MobileChampionPosition : null;
  const position = requestedPosition && defaultOverview.positions.some((row) => row.position === requestedPosition && row.picks > 0)
    ? requestedPosition
    : defaultOverview.selectedPosition;
  const analysis = buildChampionAnalysis(data, champion.id, position as PlayerPosition);
  const directory = buildChampionDirectory(data).filter((row) => row.draft.picks > 0 || row.draft.bans > 0);
  const representativePatch = scope.patch !== "all" ? scope.patch : analysis.games[0]?.patch ?? data.sets.find((set) => set.patch)?.patch;
  const build = await buildMobileBuild(analysis, champion, representativePatch);

  return {
    schemaVersion: 1,
    champion: toChampion(champion)!,
    champions: directory.map((row) => toChampion(row.champion)!),
    scope: scopeDto(scope),
    selectedPosition: analysis.overview.selectedPosition,
    positions: analysis.overview.positions.filter((row) => row.picks > 0).map((row) => ({
      value: row.position,
      label: POSITION_LABEL[row.position],
      picks: row.picks,
    })),
    summary: {
      picks: analysis.overview.selected.picks,
      bans: analysis.overview.draft.bans,
      presenceRate: analysis.overview.draft.presenceRate,
      winRate: analysis.overview.selected.winRate,
      wins: analysis.overview.selected.wins,
      losses: analysis.overview.selected.losses,
    },
    build,
    matchups: analysis.matchups.map((row) => ({
      champion: toChampion(row.opponentChampion), games: row.games, wins: row.wins, losses: row.losses,
      winRate: row.winRate, goldDiffAt15: row.metrics.goldDiffAt15.value,
    })),
    duos: analysis.duos.map((row) => ({
      champion: toChampion(row.partnerChampion), games: row.games, wins: row.wins, losses: row.losses,
      winRate: row.winRate, goldDiffAt15: row.duoGoldDiffAt15.value,
    })),
    pros: analysis.players.map((row) => ({
      player: toPlayer(row.player),
      team: teamForPlayer(row.player, data.teams),
      games: row.games,
      winRate: row.winRate,
      kda: row.kda,
      dpm: row.dpm.value,
      goldDiffAt15: row.goldDiffAt15.value,
    })),
    games: analysis.games.map((row) => {
      const ids = [...row.finalItemIds.slice(0, 6), ...(row.trinketId ? [row.trinketId] : [])];
      const version = ddragonVersionFromPatch(row.patch);
      return {
        setId: row.setId,
        matchId: row.matchId,
        href: row.href,
        result: row.result,
        tournament: compactTournamentLabel(row.tournamentName ?? row.matchName),
        player: toPlayer(row.player),
        opponentChampion: toChampion(row.opponentChampion),
        kills: row.kills,
        deaths: row.deaths,
        assists: row.assists,
        kda: row.metrics.kda.value,
        items: ids.map((id) => ({ id, image: image(itemImageUrl(id, version)) })),
      };
    }),
    stats: {
      patches: analysis.overview.patches.map((row) => ({ patch: row.patch, games: row.games, wins: row.wins, losses: row.losses, winRate: row.winRate })),
      sides: analysis.overview.sides.map((row) => ({ side: row.side, games: row.games, wins: row.wins, losses: row.losses, winRate: row.winRate })),
      pickPhases: analysis.overview.draftDistribution.pickPhases,
      banPhases: analysis.overview.draftDistribution.banPhases,
    },
  };
}
