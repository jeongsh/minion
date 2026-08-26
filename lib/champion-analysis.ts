import type {
  Champion,
  Match,
  Player,
  PlayerPosition,
  PlayerStatLine,
  SetPickBan,
  SetResult,
  Team,
  Tournament,
} from "@/lib/types";

export const CHAMPION_POSITIONS = ["TOP", "JGL", "MID", "BOT", "SUP"] as const satisfies readonly PlayerPosition[];

export type SampleWarning = "very-low" | "low" | null;

export type ChampionBuildEvent = {
  setId: string;
  playerId: string;
  timestampMs: number;
  minute: number;
  eventType: "ITEM_PURCHASED" | "ITEM_SOLD" | "ITEM_UNDO" | "SKILL_LEVEL_UP";
  itemId: number | null;
  /** Riot ITEM_UNDO identifies the reverted purchase with beforeId. */
  beforeItemId?: number | null;
  afterItemId?: number | null;
  skillSlot?: number | null;
  levelUpType?: string | null;
};

export type ChampionAnalysisInput = {
  champions: readonly Champion[];
  players?: readonly Player[];
  teams?: readonly Team[];
  tournaments?: readonly Tournament[];
  matches?: readonly Match[];
  /** The caller scopes sets by season, tournament and patch before aggregation. */
  sets: readonly SetResult[];
  pickBans: readonly SetPickBan[];
  playerStats: readonly PlayerStatLine[];
  buildEvents?: readonly ChampionBuildEvent[];
};

export type Coverage = {
  recordedGames: number;
  totalGames: number;
  rate: number;
  isPartial: boolean;
};

export type AverageMetric = {
  value: number | null;
  recordedGames: number;
};

export type ChampionMetrics = {
  kda: AverageMetric;
  dpm: AverageMetric;
  csPerMinute: AverageMetric;
  visionScorePerMinute: AverageMetric;
  goldDiffAt15: AverageMetric;
  xpDiffAt15: AverageMetric;
  csDiffAt15: AverageMetric;
};

export type ChampionRecordSummary = {
  /** Stat rows in scope, including rows whose result is not yet known. */
  picks: number;
  /** Stat rows whose set has a winner and can therefore produce W/L. */
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
  sampleWarning: SampleWarning;
  metrics: ChampionMetrics;
};

export type ChampionPositionSummary = ChampionRecordSummary & {
  position: PlayerPosition;
  pickShare: number;
};

export type ChampionDraftSummary = {
  eligibleSets: number;
  incompleteSets: number;
  picks: number;
  bans: number;
  pickRate: number | null;
  banRate: number | null;
  presenceRate: number | null;
};

export type ChampionDirectoryRow = {
  champion: Champion;
  draft: ChampionDraftSummary;
  record: ChampionRecordSummary;
  positions: ChampionPositionSummary[];
};

export type ChampionSideSummary = ChampionRecordSummary & {
  side: "blue" | "red";
};

export type ChampionPatchSummary = ChampionRecordSummary & {
  patch: string;
};

export type CountDistribution = {
  key: string;
  count: number;
  rate: number;
};

export type ChampionDraftDistribution = {
  pickPhases: CountDistribution[];
  banPhases: CountDistribution[];
  pickSlots: CountDistribution[];
  banSlots: CountDistribution[];
  pickSides: CountDistribution[];
  banSides: CountDistribution[];
};

export type ChampionOverview = {
  championId: string;
  champion: Champion | null;
  draft: ChampionDraftSummary;
  overall: ChampionRecordSummary;
  positions: ChampionPositionSummary[];
  selectedPosition: PlayerPosition;
  selected: ChampionPositionSummary;
  sides: ChampionSideSummary[];
  patches: ChampionPatchSummary[];
  patchCoverage: Coverage;
  draftDistribution: ChampionDraftDistribution;
};

export type RecentResult = {
  setId: string;
  result: "W" | "L";
  matchDate: string | null;
};

export type ChampionMatchup = {
  opponentChampionId: string;
  opponentChampion: Champion | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  sampleWarning: SampleWarning;
  metrics: Pick<ChampionMetrics, "goldDiffAt15" | "xpDiffAt15" | "csDiffAt15">;
  recentResults: RecentResult[];
  setIds: string[];
};

export type ChampionPlayerPair = {
  botPlayerId: string;
  botPlayer: Player | null;
  supPlayerId: string;
  supPlayer: Player | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type ChampionOpponentDuo = {
  botChampionId: string;
  botChampion: Champion | null;
  supChampionId: string;
  supChampion: Champion | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  sampleWarning: SampleWarning;
  recentResults: RecentResult[];
  setIds: string[];
};

export type ChampionDuo = {
  championId: string;
  position: "BOT" | "SUP";
  partnerPosition: "BOT" | "SUP";
  partnerChampionId: string;
  partnerChampion: Champion | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  sampleWarning: SampleWarning;
  duoGoldDiffAt15: AverageMetric;
  playerPairs: ChampionPlayerPair[];
  opponentDuos: ChampionOpponentDuo[];
  setIds: string[];
};

export type HistoricalTeamUsage = {
  teamId: string;
  team: Team | null;
  games: number;
  wins: number;
  losses: number;
};

export type ChampionPlayerPreference = {
  playerId: string;
  player: Player | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  sampleWarning: SampleWarning;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  dpm: AverageMetric;
  goldDiffAt15: AverageMetric;
  lastUsedAt: string | null;
  historicalTeams: HistoricalTeamUsage[];
};

export type NumericPreference = {
  id: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  selectionRate: number;
  sampleWarning: SampleWarning;
};

export type NumericTuplePreference = {
  ids: number[];
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  selectionRate: number;
  sampleWarning: SampleWarning;
};

export type RunePagePreference = {
  /** Leaguepedia order: keystone, primary 3, secondary 2, stat shards 3. */
  names: string[];
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  selectionRate: number;
  sampleWarning: SampleWarning;
};

export type NormalizedPurchase = {
  itemId: number;
  timestampMs: number;
  minute: number;
  state: "held" | "sold";
};

export type GamePurchaseSequence = {
  setId: string;
  playerId: string;
  purchases: NormalizedPurchase[];
};

export type CompletedItemSequenceSummary = {
  ids: number[];
  averageMinutes: number[];
  games: number;
  eligibleGames: number;
  wins: number;
  losses: number;
  winRate: number;
  selectionRate: number;
};

/**
 * Groups literal, chronological completed-item purchases into observed build paths.
 *
 * The caller owns patch-aware item classification because item completion rules can
 * change between Data Dragon versions. Duplicate purchases are intentionally kept:
 * selling and buying the same completed item again is still part of the real order.
 * The selection-rate denominator is games with at least one recognized completed
 * purchase, never all champion games or unordered final inventory slots.
 */
export function buildCompletedItemSequenceSummaries({
  sequences,
  games,
  isCompletedItem,
  minItems = 1,
  maxItems = 3,
}: {
  sequences: readonly GamePurchaseSequence[];
  games: ReadonlyArray<{ setId: string; playerId: string; result: "W" | "L" }>;
  isCompletedItem: (itemId: number, context: { setId: string; playerId: string }) => boolean;
  minItems?: number;
  maxItems?: number;
}): CompletedItemSequenceSummary[] {
  const normalizedMaxItems = Math.max(1, Math.floor(maxItems));
  const normalizedMinItems = Math.max(1, Math.min(normalizedMaxItems, Math.floor(minItems)));
  const gameByKey = new Map(games.map((game) => [`${game.setId}:${game.playerId}`, game]));
  const observed: Array<{ ids: number[]; minutes: number[]; result: "W" | "L" | null }> = [];

  for (const sequence of sequences) {
    const context = { setId: sequence.setId, playerId: sequence.playerId };
    const purchases = sequence.purchases
      .filter((purchase) => isCompletedItem(purchase.itemId, context))
      .slice(0, normalizedMaxItems);
    if (purchases.length < normalizedMinItems) continue;

    observed.push({
      ids: purchases.map((purchase) => purchase.itemId),
      minutes: purchases.map((purchase) => purchase.minute),
      result: gameByKey.get(`${sequence.setId}:${sequence.playerId}`)?.result ?? null,
    });
  }

  const groups = new Map<string, typeof observed>();
  for (const row of observed) {
    const key = row.ids.join(",");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      const wins = group.filter((row) => row.result === "W").length;
      const losses = group.filter((row) => row.result === "L").length;
      const decidedGames = wins + losses;
      return {
        ids: group[0].ids,
        averageMinutes: group[0].ids.map((_, index) =>
          group.reduce((sum, row) => sum + (row.minutes[index] ?? 0), 0) / group.length,
        ),
        games: group.length,
        eligibleGames: observed.length,
        wins,
        losses,
        winRate: decidedGames ? (wins / decidedGames) * 100 : 0,
        selectionRate: observed.length ? (group.length / observed.length) * 100 : 0,
      };
    })
    .sort((left, right) => right.games - left.games || right.wins - left.wins);
}

export type ChampionLoadoutPreferences = {
  totalGames: number;
  coverage: {
    runePair: Coverage;
    fullRunePage: Coverage;
    spells: Coverage;
    finalItems: Coverage;
    purchaseOrder: Coverage;
    skillOrder: Coverage;
  };
  keystones: NumericPreference[];
  secondaryRuneTrees: NumericPreference[];
  runePairs: NumericTuplePreference[];
  fullRunePages: RunePagePreference[];
  spellCombinations: NumericTuplePreference[];
  /** Slots 0-5 only, with role-bound items removed and duplicate copies counted once per game. */
  finalItems: NumericPreference[];
  /** Slot 6 is kept separate because it is a trinket, not a core item slot. */
  trinkets: NumericPreference[];
  roleBoundItems: NumericPreference[];
  /** Sorted sets of slots 0-5. Slot order is never interpreted as purchase order. */
  finalItemCombinations: NumericTuplePreference[];
  /** Chronological observed purchases after undo removal; sold purchases stay marked in game sequences. */
  purchaseSequences: NumericTuplePreference[];
  gamePurchaseSequences: GamePurchaseSequence[];
  skillOrders: NumericTuplePreference[];
};

export type ChampionGameRow = {
  setId: string;
  setNumber: number;
  matchId: string;
  matchName: string | null;
  matchDate: string | null;
  tournamentId: string | null;
  tournamentName: string | null;
  patch: string | null;
  playerId: string;
  player: Player | null;
  teamId: string;
  team: Team | null;
  opponentPlayerId: string | null;
  opponentPlayer: Player | null;
  opponentChampionId: string | null;
  opponentChampion: Champion | null;
  side: "blue" | "red" | null;
  result: "W" | "L";
  kills: number;
  deaths: number;
  assists: number;
  metrics: ChampionMetrics;
  runeIds: number[];
  fullRuneNames: string[] | null;
  spellIds: number[];
  finalItemIds: number[];
  trinketId: number | null;
  roleBoundItemId: number | null;
  purchaseSequence: NormalizedPurchase[];
  href: string | null;
  cursor: string;
};

export type ChampionAnalysis = {
  overview: ChampionOverview;
  matchups: ChampionMatchup[];
  duos: ChampionDuo[];
  players: ChampionPlayerPreference[];
  loadouts: ChampionLoadoutPreferences;
  games: ChampionGameRow[];
};

type ScopedData = {
  setsById: Map<string, SetResult>;
  matchesById: Map<string, Match>;
  tournamentsById: Map<string, Tournament>;
  championsById: Map<string, Champion>;
  playersById: Map<string, Player>;
  teamsById: Map<string, Team>;
  stats: PlayerStatLine[];
  pickBans: SetPickBan[];
  completeDraftSetIds: Set<string>;
};

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validId(value: unknown): value is number {
  return validNumber(value) && value > 0;
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

function selectionPercentage(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export function sampleWarning(games: number): SampleWarning {
  if (games <= 0 || games >= 5) return null;
  return games <= 2 ? "very-low" : "low";
}

function coverage(recordedGames: number, totalGames: number): Coverage {
  return {
    recordedGames,
    totalGames,
    rate: selectionPercentage(recordedGames, totalGames),
    isPartial: recordedGames > 0 && recordedGames < totalGames,
  };
}

function averageMetric<T>(rows: readonly T[], read: (row: T) => number | null | undefined): AverageMetric {
  const values = rows.map(read).filter(validNumber);
  return {
    value: values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    recordedGames: values.length,
  };
}

function perMinute(value: number, minutes: number) {
  return minutes > 0 && Number.isFinite(value) ? value / minutes : null;
}

function effectiveDpm(line: PlayerStatLine) {
  return validNumber(line.dpm) ? line.dpm : perMinute(line.damageToChampions, line.gameMinutes);
}

function effectiveCsm(line: PlayerStatLine) {
  return validNumber(line.csPerMinute) ? line.csPerMinute : perMinute(line.cs, line.gameMinutes);
}

function effectiveVspm(line: PlayerStatLine) {
  return validNumber(line.visionScorePerMinute)
    ? line.visionScorePerMinute
    : perMinute(line.visionScore, line.gameMinutes);
}

function metricsFor(lines: readonly PlayerStatLine[]): ChampionMetrics {
  const kills = lines.reduce((sum, line) => sum + (validNumber(line.kills) ? line.kills : 0), 0);
  const deaths = lines.reduce((sum, line) => sum + (validNumber(line.deaths) ? line.deaths : 0), 0);
  const assists = lines.reduce((sum, line) => sum + (validNumber(line.assists) ? line.assists : 0), 0);

  return {
    kda: {
      value: lines.length > 0 ? (kills + assists) / Math.max(deaths, 1) : null,
      recordedGames: lines.length,
    },
    dpm: averageMetric(lines, effectiveDpm),
    csPerMinute: averageMetric(lines, effectiveCsm),
    visionScorePerMinute: averageMetric(lines, effectiveVspm),
    goldDiffAt15: averageMetric(lines, (line) => line.goldDiffAt15),
    xpDiffAt15: averageMetric(lines, (line) => line.xpDiffAt15),
    csDiffAt15: averageMetric(lines, (line) => line.csDiffAt15),
  };
}

function scopedData(input: ChampionAnalysisInput): ScopedData {
  const setsById = new Map(input.sets.map((set) => [set.id, set]));
  const seenStats = new Set<string>();
  const stats = input.playerStats.filter((line) => {
    if (!setsById.has(line.setId)) return false;
    const key = `${line.setId}\u0000${line.playerId}`;
    if (seenStats.has(key)) return false;
    seenStats.add(key);
    return true;
  });
  const seenPickBans = new Set<string>();
  const pickBans = input.pickBans.filter((entry) => {
    if (!setsById.has(entry.setId)) return false;
    const key = entry.id || `${entry.setId}\u0000${entry.actionType}\u0000${entry.orderIndex}\u0000${entry.teamId}`;
    if (seenPickBans.has(key)) return false;
    seenPickBans.add(key);
    return true;
  });
  const draftsBySet = new Map<string, SetPickBan[]>();
  for (const entry of pickBans) {
    const list = draftsBySet.get(entry.setId) ?? [];
    list.push(entry);
    draftsBySet.set(entry.setId, list);
  }
  const completeDraftSetIds = new Set<string>();
  for (const set of input.sets) {
    const rows = draftsBySet.get(set.id) ?? [];
    if (
      rows.filter((entry) => entry.actionType === "pick").length === 10 &&
      rows.filter((entry) => entry.actionType === "ban").length === 10
    ) {
      completeDraftSetIds.add(set.id);
    }
  }

  return {
    setsById,
    matchesById: new Map((input.matches ?? []).map((match) => [match.id, match])),
    tournamentsById: new Map((input.tournaments ?? []).map((tournament) => [tournament.id, tournament])),
    championsById: new Map(input.champions.map((champion) => [champion.id, champion])),
    playersById: new Map((input.players ?? []).map((player) => [player.id, player])),
    teamsById: new Map((input.teams ?? []).map((team) => [team.id, team])),
    stats,
    pickBans,
    completeDraftSetIds,
  };
}

function championLines(data: ScopedData, championId: string, position?: PlayerPosition) {
  return data.stats.filter(
    (line) => line.championId === championId && (!position || line.position === position),
  );
}

function resultLines(data: ScopedData, lines: readonly PlayerStatLine[]) {
  return lines.filter((line) => Boolean(data.setsById.get(line.setId)?.winnerTeamId));
}

function lineWon(data: ScopedData, line: PlayerStatLine) {
  return data.setsById.get(line.setId)?.winnerTeamId === line.teamId;
}

function recordFor(data: ScopedData, lines: readonly PlayerStatLine[]): ChampionRecordSummary {
  const decided = resultLines(data, lines);
  const wins = decided.filter((line) => lineWon(data, line)).length;
  return {
    picks: lines.length,
    games: decided.length,
    wins,
    losses: decided.length - wins,
    winRate: percentage(wins, decided.length),
    sampleWarning: sampleWarning(decided.length),
    metrics: metricsFor(decided),
  };
}

function positionSummaries(data: ScopedData, championId: string) {
  const allLines = championLines(data, championId);
  return CHAMPION_POSITIONS.map((position) => {
    const summary = recordFor(data, allLines.filter((line) => line.position === position));
    return {
      position,
      ...summary,
      pickShare: selectionPercentage(summary.picks, allLines.length),
    } satisfies ChampionPositionSummary;
  });
}

function draftSummary(data: ScopedData, championId: string): ChampionDraftSummary {
  const completeRows = data.pickBans.filter((entry) => data.completeDraftSetIds.has(entry.setId));
  const pickSets = new Set(
    completeRows
      .filter((entry) => entry.actionType === "pick" && entry.championId === championId)
      .map((entry) => entry.setId),
  );
  const banSets = new Set(
    completeRows
      .filter((entry) => entry.actionType === "ban" && entry.championId === championId)
      .map((entry) => entry.setId),
  );
  const eligibleSets = data.completeDraftSetIds.size;
  return {
    eligibleSets,
    incompleteSets: data.setsById.size - eligibleSets,
    picks: pickSets.size,
    bans: banSets.size,
    pickRate: percentage(pickSets.size, eligibleSets),
    banRate: percentage(banSets.size, eligibleSets),
    presenceRate: percentage(pickSets.size + banSets.size, eligibleSets),
  };
}

function resolveSelectedPosition(positions: readonly ChampionPositionSummary[], requested?: PlayerPosition) {
  if (requested) return requested;
  return [...positions].sort(
    (left, right) => right.picks - left.picks || CHAMPION_POSITIONS.indexOf(left.position) - CHAMPION_POSITIONS.indexOf(right.position),
  )[0]?.position ?? "TOP";
}

function compareChampionName(left: Champion | null, right: Champion | null) {
  return (left?.name ?? "").localeCompare(right?.name ?? "", "ko");
}

export function buildChampionDirectory(
  input: ChampionAnalysisInput,
  options: { position?: PlayerPosition } = {},
): ChampionDirectoryRow[] {
  const data = scopedData(input);
  return input.champions
    .map((champion) => {
      const positions = positionSummaries(data, champion.id);
      return {
        champion,
        draft: draftSummary(data, champion.id),
        record: options.position
          ? positions.find((summary) => summary.position === options.position)!
          : recordFor(data, championLines(data, champion.id)),
        positions,
      } satisfies ChampionDirectoryRow;
    })
    .sort(
      (left, right) =>
        (right.draft.presenceRate ?? -1) - (left.draft.presenceRate ?? -1) ||
        right.draft.picks - left.draft.picks ||
        compareChampionName(left.champion, right.champion),
    );
}

function distribution(rows: readonly SetPickBan[], read: (row: SetPickBan) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(read(row), (counts.get(read(row)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, rate: selectionPercentage(count, rows.length) }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function normalizedPatch(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+)\.(\d+)/);
  return match ? `${Number(match[1])}.${Number(match[2])}` : trimmed;
}

function comparePatch(left: string, right: string) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  if (leftParts.every(Number.isFinite) && rightParts.every(Number.isFinite)) {
    return (leftParts[0] ?? 0) - (rightParts[0] ?? 0) || (leftParts[1] ?? 0) - (rightParts[1] ?? 0);
  }
  return left.localeCompare(right);
}

export function buildChampionOverview(
  input: ChampionAnalysisInput,
  championId: string,
  position?: PlayerPosition,
): ChampionOverview {
  const data = scopedData(input);
  const positions = positionSummaries(data, championId);
  const selectedPosition = resolveSelectedPosition(positions, position);
  const selected = positions.find((summary) => summary.position === selectedPosition)!;
  const selectedLines = championLines(data, championId, selectedPosition);
  const sides = (["blue", "red"] as const).map((side) => ({
    side,
    ...recordFor(
      data,
      selectedLines.filter((line) => {
        const set = data.setsById.get(line.setId);
        return side === "blue" ? set?.blueTeamId === line.teamId : set?.redTeamId === line.teamId;
      }),
    ),
  }));

  const patchLines = new Map<string, PlayerStatLine[]>();
  let patchRecordedPicks = 0;
  for (const line of selectedLines) {
    const patch = normalizedPatch(data.setsById.get(line.setId)?.patch ?? line.patch);
    if (!patch) continue;
    patchRecordedPicks += 1;
    const rows = patchLines.get(patch) ?? [];
    rows.push(line);
    patchLines.set(patch, rows);
  }
  const patches = [...patchLines.entries()]
    .map(([patch, lines]) => ({ patch, ...recordFor(data, lines) }))
    .sort((left, right) => comparePatch(left.patch, right.patch));

  const championDraftRows = data.pickBans.filter(
    (entry) => entry.championId === championId && data.completeDraftSetIds.has(entry.setId),
  );
  const picks = championDraftRows.filter((entry) => entry.actionType === "pick");
  const bans = championDraftRows.filter((entry) => entry.actionType === "ban");

  return {
    championId,
    champion: data.championsById.get(championId) ?? null,
    draft: draftSummary(data, championId),
    overall: recordFor(data, championLines(data, championId)),
    positions,
    selectedPosition,
    selected,
    sides,
    patches,
    patchCoverage: coverage(patchRecordedPicks, selectedLines.length),
    draftDistribution: {
      pickPhases: distribution(picks, (entry) => entry.phase),
      banPhases: distribution(bans, (entry) => entry.phase),
      pickSlots: distribution(picks, (entry) => String(entry.orderIndex)),
      banSlots: distribution(bans, (entry) => String(entry.orderIndex)),
      pickSides: distribution(picks, (entry) => entry.side),
      banSides: distribution(bans, (entry) => entry.side),
    },
  };
}

function matchDateForSet(data: ScopedData, setId: string) {
  const set = data.setsById.get(setId);
  return set ? (data.matchesById.get(set.matchId)?.matchDate ?? null) : null;
}

function compareRecent(left: RecentResult, right: RecentResult) {
  return (right.matchDate ?? "").localeCompare(left.matchDate ?? "") || right.setId.localeCompare(left.setId);
}

function opponentForLine(data: ScopedData, line: PlayerStatLine) {
  const candidates = data.stats.filter(
    (candidate) =>
      candidate.setId === line.setId &&
      candidate.teamId !== line.teamId &&
      candidate.position === line.position &&
      Boolean(candidate.championId),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export function buildChampionMatchups(
  input: ChampionAnalysisInput,
  championId: string,
  position: PlayerPosition,
): ChampionMatchup[] {
  const data = scopedData(input);
  const grouped = new Map<string, Array<{ line: PlayerStatLine; opponent: PlayerStatLine }>>();
  for (const line of resultLines(data, championLines(data, championId, position))) {
    const opponent = opponentForLine(data, line);
    if (!opponent?.championId) continue;
    const rows = grouped.get(opponent.championId) ?? [];
    rows.push({ line, opponent });
    grouped.set(opponent.championId, rows);
  }

  return [...grouped.entries()]
    .map(([opponentChampionId, rows]) => {
      const wins = rows.filter(({ line }) => lineWon(data, line)).length;
      const recentResults = rows
        .map(({ line }) => ({
          setId: line.setId,
          result: lineWon(data, line) ? "W" as const : "L" as const,
          matchDate: matchDateForSet(data, line.setId),
        }))
        .sort(compareRecent)
        .slice(0, 5);
      const selectedLines = rows.map(({ line }) => line);
      return {
        opponentChampionId,
        opponentChampion: data.championsById.get(opponentChampionId) ?? null,
        games: rows.length,
        wins,
        losses: rows.length - wins,
        winRate: selectionPercentage(wins, rows.length),
        sampleWarning: sampleWarning(rows.length),
        metrics: {
          goldDiffAt15: averageMetric(selectedLines, (line) => line.goldDiffAt15),
          xpDiffAt15: averageMetric(selectedLines, (line) => line.xpDiffAt15),
          csDiffAt15: averageMetric(selectedLines, (line) => line.csDiffAt15),
        },
        recentResults,
        setIds: rows.map(({ line }) => line.setId),
      } satisfies ChampionMatchup;
    })
    .sort(
      (left, right) =>
        right.games - left.games ||
        right.wins - left.wins ||
        compareChampionName(left.opponentChampion, right.opponentChampion),
    );
}

function teamPositionLine(data: ScopedData, setId: string, teamId: string, position: PlayerPosition) {
  const rows = data.stats.filter(
    (line) => line.setId === setId && line.teamId === teamId && line.position === position && Boolean(line.championId),
  );
  return rows.length === 1 ? rows[0] : null;
}

function opposingTeamId(set: SetResult, teamId: string) {
  if (set.blueTeamId === teamId) return set.redTeamId;
  if (set.redTeamId === teamId) return set.blueTeamId;
  return null;
}

export function buildChampionDuos(
  input: ChampionAnalysisInput,
  championId: string,
  position: PlayerPosition,
): ChampionDuo[] {
  if (position !== "BOT" && position !== "SUP") return [];
  const data = scopedData(input);
  const partnerPosition: "BOT" | "SUP" = position === "BOT" ? "SUP" : "BOT";
  const grouped = new Map<string, Array<{ selected: PlayerStatLine; partner: PlayerStatLine }>>();

  for (const selected of resultLines(data, championLines(data, championId, position))) {
    const partner = teamPositionLine(data, selected.setId, selected.teamId, partnerPosition);
    if (!partner?.championId) continue;
    const rows = grouped.get(partner.championId) ?? [];
    rows.push({ selected, partner });
    grouped.set(partner.championId, rows);
  }

  return [...grouped.entries()]
    .map(([partnerChampionId, rows]) => {
      const wins = rows.filter(({ selected }) => lineWon(data, selected)).length;
      const playerPairGroups = new Map<string, typeof rows>();
      const opponentGroups = new Map<string, Array<{ selected: PlayerStatLine; bot: PlayerStatLine; sup: PlayerStatLine }>>();
      for (const row of rows) {
        const bot = position === "BOT" ? row.selected : row.partner;
        const sup = position === "SUP" ? row.selected : row.partner;
        const playerKey = `${bot.playerId}\u0000${sup.playerId}`;
        const playerRows = playerPairGroups.get(playerKey) ?? [];
        playerRows.push(row);
        playerPairGroups.set(playerKey, playerRows);

        const set = data.setsById.get(row.selected.setId);
        const enemyTeamId = set ? opposingTeamId(set, row.selected.teamId) : null;
        if (!enemyTeamId) continue;
        const enemyBot = teamPositionLine(data, row.selected.setId, enemyTeamId, "BOT");
        const enemySup = teamPositionLine(data, row.selected.setId, enemyTeamId, "SUP");
        if (!enemyBot?.championId || !enemySup?.championId) continue;
        const opponentKey = `${enemyBot.championId}\u0000${enemySup.championId}`;
        const opponentRows = opponentGroups.get(opponentKey) ?? [];
        opponentRows.push({ selected: row.selected, bot: enemyBot, sup: enemySup });
        opponentGroups.set(opponentKey, opponentRows);
      }

      const playerPairs = [...playerPairGroups.values()]
        .map((pairRows) => {
          const bot = position === "BOT" ? pairRows[0].selected : pairRows[0].partner;
          const sup = position === "SUP" ? pairRows[0].selected : pairRows[0].partner;
          const pairWins = pairRows.filter(({ selected }) => lineWon(data, selected)).length;
          return {
            botPlayerId: bot.playerId,
            botPlayer: data.playersById.get(bot.playerId) ?? null,
            supPlayerId: sup.playerId,
            supPlayer: data.playersById.get(sup.playerId) ?? null,
            games: pairRows.length,
            wins: pairWins,
            losses: pairRows.length - pairWins,
            winRate: selectionPercentage(pairWins, pairRows.length),
          } satisfies ChampionPlayerPair;
        })
        .sort((left, right) => right.games - left.games || right.wins - left.wins)
        .slice(0, 3);

      const opponentDuos = [...opponentGroups.values()]
        .map((opponentRows) => {
          const first = opponentRows[0];
          const opponentWins = opponentRows.filter(({ selected }) => lineWon(data, selected)).length;
          return {
            botChampionId: first.bot.championId!,
            botChampion: data.championsById.get(first.bot.championId!) ?? null,
            supChampionId: first.sup.championId!,
            supChampion: data.championsById.get(first.sup.championId!) ?? null,
            games: opponentRows.length,
            wins: opponentWins,
            losses: opponentRows.length - opponentWins,
            winRate: selectionPercentage(opponentWins, opponentRows.length),
            sampleWarning: sampleWarning(opponentRows.length),
            recentResults: opponentRows
              .map(({ selected }) => ({
                setId: selected.setId,
                result: lineWon(data, selected) ? "W" as const : "L" as const,
                matchDate: matchDateForSet(data, selected.setId),
              }))
              .sort(compareRecent)
              .slice(0, 5),
            setIds: opponentRows.map(({ selected }) => selected.setId),
          } satisfies ChampionOpponentDuo;
        })
        .sort((left, right) => right.games - left.games || right.wins - left.wins);

      const duoGoldRows = rows
        .map(({ selected, partner }) =>
          validNumber(selected.goldDiffAt15) && validNumber(partner.goldDiffAt15)
            ? selected.goldDiffAt15 + partner.goldDiffAt15
            : null,
        )
        .filter(validNumber);

      return {
        championId,
        position,
        partnerPosition,
        partnerChampionId,
        partnerChampion: data.championsById.get(partnerChampionId) ?? null,
        games: rows.length,
        wins,
        losses: rows.length - wins,
        winRate: selectionPercentage(wins, rows.length),
        sampleWarning: sampleWarning(rows.length),
        duoGoldDiffAt15: {
          value: duoGoldRows.length > 0
            ? duoGoldRows.reduce((sum, value) => sum + value, 0) / duoGoldRows.length
            : null,
          recordedGames: duoGoldRows.length,
        },
        playerPairs,
        opponentDuos,
        setIds: rows.map(({ selected }) => selected.setId),
      } satisfies ChampionDuo;
    })
    .sort(
      (left, right) =>
        right.games - left.games ||
        right.wins - left.wins ||
        compareChampionName(left.partnerChampion, right.partnerChampion),
    );
}

export function buildChampionPlayerPreferences(
  input: ChampionAnalysisInput,
  championId: string,
  position: PlayerPosition,
): ChampionPlayerPreference[] {
  const data = scopedData(input);
  const grouped = new Map<string, PlayerStatLine[]>();
  for (const line of resultLines(data, championLines(data, championId, position))) {
    const rows = grouped.get(line.playerId) ?? [];
    rows.push(line);
    grouped.set(line.playerId, rows);
  }

  return [...grouped.entries()]
    .map(([playerId, lines]) => {
      const wins = lines.filter((line) => lineWon(data, line)).length;
      const kills = lines.reduce((sum, line) => sum + line.kills, 0);
      const deaths = lines.reduce((sum, line) => sum + line.deaths, 0);
      const assists = lines.reduce((sum, line) => sum + line.assists, 0);
      const teamGroups = new Map<string, PlayerStatLine[]>();
      for (const line of lines) {
        const rows = teamGroups.get(line.teamId) ?? [];
        rows.push(line);
        teamGroups.set(line.teamId, rows);
      }
      const lastUsedAt = lines
        .map((line) => matchDateForSet(data, line.setId))
        .filter((date): date is string => Boolean(date))
        .sort((left, right) => right.localeCompare(left))[0] ?? null;

      return {
        playerId,
        player: data.playersById.get(playerId) ?? null,
        games: lines.length,
        wins,
        losses: lines.length - wins,
        winRate: selectionPercentage(wins, lines.length),
        sampleWarning: sampleWarning(lines.length),
        kills,
        deaths,
        assists,
        kda: (kills + assists) / Math.max(deaths, 1),
        dpm: averageMetric(lines, effectiveDpm),
        goldDiffAt15: averageMetric(lines, (line) => line.goldDiffAt15),
        lastUsedAt,
        historicalTeams: [...teamGroups.entries()]
          .map(([teamId, teamLines]) => {
            const teamWins = teamLines.filter((line) => lineWon(data, line)).length;
            return {
              teamId,
              team: data.teamsById.get(teamId) ?? null,
              games: teamLines.length,
              wins: teamWins,
              losses: teamLines.length - teamWins,
            };
          })
          .sort((left, right) => right.games - left.games || right.wins - left.wins),
      } satisfies ChampionPlayerPreference;
    })
    .sort((left, right) => right.games - left.games || right.wins - left.wins || (left.player?.name ?? "").localeCompare(right.player?.name ?? "", "ko"));
}

type PreferenceAccumulator<T> = {
  value: T;
  lines: PlayerStatLine[];
};

function groupPreferences<T>(
  lines: readonly PlayerStatLine[],
  valueFor: (line: PlayerStatLine) => T | null,
  keyFor: (value: T) => string,
) {
  const groups = new Map<string, PreferenceAccumulator<T>>();
  for (const line of lines) {
    const value = valueFor(line);
    if (value === null) continue;
    const key = keyFor(value);
    const group = groups.get(key) ?? { value, lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  }
  return groups;
}

function numericPreferences(
  data: ScopedData,
  groups: Map<string, PreferenceAccumulator<number>>,
  denominator: number,
): NumericPreference[] {
  return [...groups.values()]
    .map(({ value: id, lines }) => {
      const wins = lines.filter((line) => lineWon(data, line)).length;
      return {
        id,
        games: lines.length,
        wins,
        losses: lines.length - wins,
        winRate: selectionPercentage(wins, lines.length),
        selectionRate: selectionPercentage(lines.length, denominator),
        sampleWarning: sampleWarning(lines.length),
      };
    })
    .sort((left, right) => right.games - left.games || right.wins - left.wins || left.id - right.id);
}

function tuplePreferences(
  data: ScopedData,
  groups: Map<string, PreferenceAccumulator<number[]>>,
  denominator: number,
): NumericTuplePreference[] {
  return [...groups.values()]
    .map(({ value: ids, lines }) => {
      const wins = lines.filter((line) => lineWon(data, line)).length;
      return {
        ids,
        games: lines.length,
        wins,
        losses: lines.length - wins,
        winRate: selectionPercentage(wins, lines.length),
        selectionRate: selectionPercentage(lines.length, denominator),
        sampleWarning: sampleWarning(lines.length),
      };
    })
    .sort((left, right) => right.games - left.games || right.wins - left.wins || left.ids.join(",").localeCompare(right.ids.join(",")));
}

function validRunePage(line: PlayerStatLine) {
  if (!line.fullRuneNames || line.fullRuneNames.length !== 9) return null;
  const names = line.fullRuneNames.map((name) => name.trim());
  return names.every(Boolean) ? names : null;
}

function validPair(values: readonly (number | null)[]) {
  return values.length >= 2 && validId(values[0]) && validId(values[1]);
}

function mainItemIds(line: PlayerStatLine) {
  const roleBound = validId(line.roleBoundItem) ? line.roleBoundItem : null;
  return [...new Set(line.itemIds.slice(0, 6).filter(validId).filter((id) => id !== roleBound))].sort((a, b) => a - b);
}

function replayPurchaseEvents(events: readonly ChampionBuildEvent[]) {
  const purchases: Array<NormalizedPurchase & { undone: boolean }> = [];
  const sorted = events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => left.event.timestampMs - right.event.timestampMs || left.index - right.index);

  for (const { event } of sorted) {
    if (event.eventType === "SKILL_LEVEL_UP") continue;
    if (event.eventType === "ITEM_PURCHASED") {
      if (!validId(event.itemId)) continue;
      purchases.push({
        itemId: event.itemId,
        timestampMs: event.timestampMs,
        minute: event.minute,
        state: "held",
        undone: false,
      });
      continue;
    }
    const targetItemId = event.eventType === "ITEM_UNDO" && validId(event.beforeItemId)
      ? event.beforeItemId
      : event.itemId;
    if (!validId(targetItemId)) continue;
    const match = [...purchases]
      .reverse()
      .find((purchase) => purchase.itemId === targetItemId && !purchase.undone && purchase.state === "held");
    if (!match) continue;
    if (event.eventType === "ITEM_UNDO") match.undone = true;
    if (event.eventType === "ITEM_SOLD") match.state = "sold";
  }

  return purchases
    .filter((purchase) => !purchase.undone)
    .map(({ undone: _undone, ...purchase }) => purchase);
}

function purchaseSequencesForLines(input: ChampionAnalysisInput, lines: readonly PlayerStatLine[]) {
  const events = input.buildEvents ?? [];
  const eventsByGamePlayer = new Map<string, ChampionBuildEvent[]>();
  for (const event of events) {
    const key = `${event.setId}\u0000${event.playerId}`;
    const rows = eventsByGamePlayer.get(key) ?? [];
    rows.push(event);
    eventsByGamePlayer.set(key, rows);
  }
  return lines
    .map((line) => ({
      line,
      sequence: replayPurchaseEvents(eventsByGamePlayer.get(`${line.setId}\u0000${line.playerId}`) ?? []),
    }))
    .filter(({ sequence }) => sequence.length > 0);
}

function isSkillSlot(value: number | null | undefined): value is 1 | 2 | 3 | 4 {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function skillSequencesForLines(input: ChampionAnalysisInput, lines: readonly PlayerStatLine[]) {
  const events = input.buildEvents ?? [];
  const eventsByGamePlayer = new Map<string, ChampionBuildEvent[]>();
  for (const event of events) {
    if (event.eventType !== "SKILL_LEVEL_UP" || event.levelUpType !== "NORMAL" || !isSkillSlot(event.skillSlot)) continue;
    const key = `${event.setId}\u0000${event.playerId}`;
    const rows = eventsByGamePlayer.get(key) ?? [];
    rows.push(event);
    eventsByGamePlayer.set(key, rows);
  }

  return lines
    .map((line) => ({
      line,
      ids: (eventsByGamePlayer.get(`${line.setId}\u0000${line.playerId}`) ?? [])
        .slice()
        .sort((left, right) => left.timestampMs - right.timestampMs)
        .map((event) => event.skillSlot)
        .filter(isSkillSlot),
    }))
    .filter(({ ids }) => ids.length > 0);
}

export function buildChampionLoadoutPreferences(
  input: ChampionAnalysisInput,
  championId: string,
  position: PlayerPosition,
): ChampionLoadoutPreferences {
  const data = scopedData(input);
  const lines = resultLines(data, championLines(data, championId, position));
  const runePairGroups = groupPreferences(
    lines,
    (line) => validPair(line.runeIds) ? line.runeIds.slice(0, 2) as number[] : null,
    (ids) => ids.join(","),
  );
  const runePairLines = [...runePairGroups.values()].reduce((sum, group) => sum + group.lines.length, 0);
  const keystoneGroups = groupPreferences(lines, (line) => validId(line.runeIds[0]) ? line.runeIds[0] : null, String);
  const secondaryGroups = groupPreferences(lines, (line) => validId(line.runeIds[1]) ? line.runeIds[1] : null, String);
  const fullRuneGroups = groupPreferences(lines, validRunePage, (names) => names.map((name) => name.toLocaleLowerCase()).join("\u0000"));
  const fullRuneRecorded = [...fullRuneGroups.values()].reduce((sum, group) => sum + group.lines.length, 0);
  const spellGroups = groupPreferences(
    lines,
    (line) => validPair(line.spellIds) ? (line.spellIds.slice(0, 2) as number[]).sort((a, b) => a - b) : null,
    (ids) => ids.join(","),
  );
  const spellRecorded = [...spellGroups.values()].reduce((sum, group) => sum + group.lines.length, 0);

  const itemLines = lines.filter((line) => line.itemIds.some(validId) || validId(line.roleBoundItem));
  const itemGroups = new Map<string, PreferenceAccumulator<number>>();
  const trinketGroups = groupPreferences(lines, (line) => validId(line.itemIds[6]) ? line.itemIds[6] : null, String);
  const roleBoundGroups = groupPreferences(lines, (line) => validId(line.roleBoundItem) ? line.roleBoundItem : null, String);
  for (const line of itemLines) {
    for (const itemId of mainItemIds(line)) {
      const key = String(itemId);
      const group = itemGroups.get(key) ?? { value: itemId, lines: [] };
      group.lines.push(line);
      itemGroups.set(key, group);
    }
  }
  const itemCombinationGroups = groupPreferences(
    itemLines,
    (line) => {
      const ids = mainItemIds(line);
      return ids.length > 0 ? ids : null;
    },
    (ids) => ids.join(","),
  );

  const fullRunePages = [...fullRuneGroups.values()]
    .map(({ value: names, lines: groupLines }) => {
      const wins = groupLines.filter((line) => lineWon(data, line)).length;
      return {
        names,
        games: groupLines.length,
        wins,
        losses: groupLines.length - wins,
        winRate: selectionPercentage(wins, groupLines.length),
        selectionRate: selectionPercentage(groupLines.length, fullRuneRecorded),
        sampleWarning: sampleWarning(groupLines.length),
      } satisfies RunePagePreference;
    })
    .sort((left, right) => right.games - left.games || right.wins - left.wins || left.names.join(",").localeCompare(right.names.join(",")));

  const purchaseLineSequences = purchaseSequencesForLines(input, lines);
  const purchaseGroups = new Map<string, PreferenceAccumulator<number[]>>();
  for (const { line, sequence } of purchaseLineSequences) {
    const ids = sequence.map((purchase) => purchase.itemId);
    const key = ids.join(",");
    const group = purchaseGroups.get(key) ?? { value: ids, lines: [] };
    group.lines.push(line);
    purchaseGroups.set(key, group);
  }
  const skillLineSequences = skillSequencesForLines(input, lines);
  const skillGroups = new Map<string, PreferenceAccumulator<number[]>>();
  for (const { line, ids } of skillLineSequences) {
    const key = ids.join(",");
    const group = skillGroups.get(key) ?? { value: ids, lines: [] };
    group.lines.push(line);
    skillGroups.set(key, group);
  }

  return {
    totalGames: lines.length,
    coverage: {
      runePair: coverage(runePairLines, lines.length),
      fullRunePage: coverage(fullRuneRecorded, lines.length),
      spells: coverage(spellRecorded, lines.length),
      finalItems: coverage(itemLines.length, lines.length),
      purchaseOrder: coverage(purchaseLineSequences.length, lines.length),
      skillOrder: coverage(skillLineSequences.length, lines.length),
    },
    keystones: numericPreferences(data, keystoneGroups, Math.max(keystoneGroups.size ? [...keystoneGroups.values()].reduce((sum, group) => sum + group.lines.length, 0) : 0, 0)),
    secondaryRuneTrees: numericPreferences(data, secondaryGroups, Math.max(secondaryGroups.size ? [...secondaryGroups.values()].reduce((sum, group) => sum + group.lines.length, 0) : 0, 0)),
    runePairs: tuplePreferences(data, runePairGroups, runePairLines),
    fullRunePages,
    spellCombinations: tuplePreferences(data, spellGroups, spellRecorded),
    finalItems: numericPreferences(data, itemGroups, itemLines.length),
    trinkets: numericPreferences(data, trinketGroups, [...trinketGroups.values()].reduce((sum, group) => sum + group.lines.length, 0)),
    roleBoundItems: numericPreferences(data, roleBoundGroups, [...roleBoundGroups.values()].reduce((sum, group) => sum + group.lines.length, 0)),
    finalItemCombinations: tuplePreferences(data, itemCombinationGroups, itemLines.length),
    purchaseSequences: tuplePreferences(data, purchaseGroups, purchaseLineSequences.length),
    gamePurchaseSequences: purchaseLineSequences.map(({ line, sequence }) => ({
      setId: line.setId,
      playerId: line.playerId,
      purchases: sequence,
    })),
    skillOrders: tuplePreferences(data, skillGroups, skillLineSequences.length),
  };
}

function sideForLine(set: SetResult, line: PlayerStatLine) {
  if (set.blueTeamId === line.teamId) return "blue" as const;
  if (set.redTeamId === line.teamId) return "red" as const;
  return null;
}

export function buildChampionGameRows(
  input: ChampionAnalysisInput,
  championId: string,
  position: PlayerPosition,
): ChampionGameRow[] {
  const data = scopedData(input);
  const purchaseByGamePlayer = new Map(
    purchaseSequencesForLines(input, resultLines(data, championLines(data, championId, position)))
      .map(({ line, sequence }) => [`${line.setId}\u0000${line.playerId}`, sequence]),
  );

  return resultLines(data, championLines(data, championId, position))
    .map((line) => {
      const set = data.setsById.get(line.setId)!;
      const match = data.matchesById.get(set.matchId) ?? null;
      const tournament = match ? data.tournamentsById.get(match.tournamentId) ?? null : null;
      const opponent = opponentForLine(data, line);
      const fullRuneNames = validRunePage(line);
      const matchDate = match?.matchDate ?? null;
      return {
        setId: set.id,
        setNumber: set.setNumber,
        matchId: set.matchId,
        matchName: match?.name ?? null,
        matchDate,
        tournamentId: tournament?.id ?? match?.tournamentId ?? null,
        tournamentName: tournament?.name ?? null,
        patch: normalizedPatch(set.patch ?? line.patch),
        playerId: line.playerId,
        player: data.playersById.get(line.playerId) ?? null,
        teamId: line.teamId,
        team: data.teamsById.get(line.teamId) ?? null,
        opponentPlayerId: opponent?.playerId ?? null,
        opponentPlayer: opponent ? data.playersById.get(opponent.playerId) ?? null : null,
        opponentChampionId: opponent?.championId ?? null,
        opponentChampion: opponent?.championId ? data.championsById.get(opponent.championId) ?? null : null,
        side: sideForLine(set, line),
        result: lineWon(data, line) ? "W" : "L",
        kills: line.kills,
        deaths: line.deaths,
        assists: line.assists,
        metrics: metricsFor([line]),
        runeIds: line.runeIds.filter(validId),
        fullRuneNames,
        spellIds: line.spellIds.filter(validId),
        finalItemIds: mainItemIds(line),
        trinketId: validId(line.itemIds[6]) ? line.itemIds[6] : null,
        roleBoundItemId: validId(line.roleBoundItem) ? line.roleBoundItem : null,
        purchaseSequence: purchaseByGamePlayer.get(`${line.setId}\u0000${line.playerId}`) ?? [],
        href: match
          ? `/matches/${encodeURIComponent(match.leaguepediaMatchId || match.id)}?tab=data&set=${encodeURIComponent(set.id)}`
          : null,
        cursor: `${matchDate ?? ""}\u0000${set.id}`,
      } satisfies ChampionGameRow;
    })
    .sort(
      (left, right) =>
        (right.matchDate ?? "").localeCompare(left.matchDate ?? "") ||
        right.setNumber - left.setNumber ||
        right.setId.localeCompare(left.setId),
    );
}

export function buildChampionAnalysis(
  input: ChampionAnalysisInput,
  championId: string,
  position?: PlayerPosition,
): ChampionAnalysis {
  const overview = buildChampionOverview(input, championId, position);
  const selectedPosition = overview.selectedPosition;
  return {
    overview,
    matchups: buildChampionMatchups(input, championId, selectedPosition),
    duos: buildChampionDuos(input, championId, selectedPosition),
    players: buildChampionPlayerPreferences(input, championId, selectedPosition),
    loadouts: buildChampionLoadoutPreferences(input, championId, selectedPosition),
    games: buildChampionGameRows(input, championId, selectedPosition),
  };
}

export const buildChampionSummary = buildChampionOverview;
export const buildChampionBotDuos = buildChampionDuos;
export const buildChampionProPreferences = buildChampionPlayerPreferences;
export const buildChampionGames = buildChampionGameRows;
