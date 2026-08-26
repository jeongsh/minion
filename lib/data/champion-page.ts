import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { createSupabaseServerClient, canQuerySupabase } from "@/lib/supabase/server";
import { normalizeSetStatus } from "@/lib/set-status";
import {
  SEASON_2026_SEGMENTS,
  segmentForTournament,
  segmentLabel,
  type SeasonSegmentKey,
} from "@/lib/tournaments/season-2026";
import type {
  Champion,
  Match,
  Player,
  PlayerStatLine,
  SetPickBan,
  SetResult,
  Team,
  Tournament,
} from "@/lib/types";

/**
 * Public champion statistics are independent of the signed-in user. Data-sync and
 * admin code can invalidate this tag after changing matches, sets, drafts, or stats.
 */
export const CHAMPION_PAGE_DATA_TAG = "champion-page-data";

const CACHE_SECONDS = 300;
const PAGE_SIZE = 1_000;
// UUIDs plus PostgREST query syntax stay comfortably below common URL limits.
// Ninety UUIDs stay within practical PostgREST URL limits. A complete draft chunk is
// at most 1,800 rows and a player-stat chunk 900 rows, keeping request count bounded.
const SET_ID_CHUNK_SIZE = 90;
const BUILD_EVENT_SET_ID_CHUNK_SIZE = 20;
const PLAYER_ID_CHUNK_SIZE = 50;
const MAX_PARALLEL_CHUNKS = 6;

const CACHE_OPTIONS: { revalidate: number; tags: string[] } = {
  revalidate: CACHE_SECONDS,
  tags: [CHAMPION_PAGE_DATA_TAG, "champions"],
};

const TEAM_COLUMNS =
  "id, slug, name, short_name, logo_url, logo_white_url, use_white_logo_on_dark, profile_image_url, background_url, primary_color, secondary_color, fan_site_host, official_homepage_url, official_youtube_url, official_x_url, official_instagram_url, leaguepedia_page, source_team_id, is_lck_team, imported_scope, is_active, head_coach, coaches, global_power_rank, popularity, search_aliases";
const PLAYER_COLUMNS =
  "id, slug, name, real_name, team_id, position, profile_image_url, stream_url, twitter_url, instagram_url, youtube_url, facebook_url, discord_url, solo_queue_account, contract_expiry, is_starter, is_lck_player, imported_scope, is_active, retired_at, leaguepedia_page, source_player_id, search_aliases";
const CHAMPION_COLUMNS =
  "id, slug, name, image_url, ddragon_id, ddragon_key, ddragon_version";
const TOURNAMENT_COLUMNS =
  "id, name, season, category, split, region, league, start_date, end_date, source, source_tournament_id";
const MATCH_COLUMNS =
  "id, tournament_id, stage_id, name, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, best_of, winner_team_id";
const SET_COLUMNS =
  "id, match_id, set_number, status, winner_team_id, result_recorded_at, blue_team_id, red_team_id, duration_seconds, patch";
const PICK_BAN_COLUMNS =
  "id, set_id, phase, action_type, order_index, team_id, champion_id, side";
const PLAYER_STAT_COLUMNS =
  "id, set_id, player_id, team_id, side, position, champion_id, champion_level, kills, deaths, assists, cs, gold, damage_to_champions, vision_score, wards_placed, wards_killed, dpm, damage_share, vision_score_per_minute, cs_per_minute, gold_diff_at_10, xp_diff_at_10, cs_diff_at_10, gold_diff_at_15, xp_diff_at_15, cs_diff_at_15, item0, item1, item2, item3, item4, item5, item6, spell0, spell1, rune0, rune1, role_bound_item, full_rune_names";
// role_bound_item exists in the active project and is already read by lib/data/lck.ts,
// but older/local schemas may predate it. Keep a read-only compatibility projection.
const PLAYER_STAT_COLUMNS_WITHOUT_ROLE_BOUND_ITEM = PLAYER_STAT_COLUMNS.replace(
  ", role_bound_item",
  "",
);
const BUILD_EVENT_COLUMNS =
  "id, set_id, player_id, timestamp_ms, minute, event_type, raw_event_json";

type TeamRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  logo_white_url: string | null;
  use_white_logo_on_dark: boolean | null;
  profile_image_url: string | null;
  background_url: string | null;
  primary_color: string;
  secondary_color: string;
  fan_site_host: string | null;
  official_homepage_url: string | null;
  official_youtube_url: string | null;
  official_x_url: string | null;
  official_instagram_url: string | null;
  leaguepedia_page: string | null;
  source_team_id: string | null;
  is_lck_team: boolean | null;
  imported_scope: Team["importedScope"] | null;
  is_active: boolean | null;
  head_coach: string | null;
  coaches: string | null;
  global_power_rank: number | null;
  popularity: number | null;
  search_aliases: string[] | null;
};

type PlayerRow = {
  id: string;
  slug: string;
  name: string;
  real_name: string | null;
  team_id: string | null;
  position: Player["position"];
  profile_image_url: string | null;
  stream_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  discord_url: string | null;
  solo_queue_account: string | null;
  contract_expiry: string | null;
  is_starter: boolean | null;
  is_lck_player: boolean | null;
  imported_scope: Player["importedScope"] | null;
  is_active: boolean | null;
  retired_at: string | null;
  leaguepedia_page: string | null;
  source_player_id: string | null;
  search_aliases: string[] | null;
};

type ChampionRow = {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  ddragon_id: string | null;
  ddragon_key: string | null;
  ddragon_version: string | null;
};

type TournamentRow = {
  id: string;
  name: string;
  season: number;
  category: string;
  split: string | null;
  region: string | null;
  league: string | null;
  start_date: string | null;
  end_date: string | null;
  source: string | null;
  source_tournament_id: string | null;
};

type MatchRow = {
  id: string;
  tournament_id: string | null;
  stage_id: string | null;
  name: string;
  match_date: string;
  status: Match["status"];
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  best_of: number | null;
  winner_team_id: string | null;
};

type SetRow = {
  id: string;
  match_id: string;
  set_number: number;
  status: SetResult["status"] | null;
  winner_team_id: string | null;
  result_recorded_at: string | null;
  blue_team_id: string | null;
  red_team_id: string | null;
  duration_seconds: number | null;
  patch: string | null;
};

type PickBanRow = {
  id: string;
  set_id: string;
  phase: string;
  action_type: SetPickBan["actionType"];
  order_index: number;
  team_id: string | null;
  champion_id: string | null;
  side: SetPickBan["side"] | null;
};

type PlayerStatRow = {
  id: string;
  set_id: string;
  player_id: string;
  team_id: string;
  side: "blue" | "red" | null;
  position: Player["position"];
  champion_id: string | null;
  champion_level: number | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage_to_champions: number;
  vision_score: number;
  wards_placed: number;
  wards_killed: number;
  dpm: number | null;
  damage_share: number | null;
  vision_score_per_minute: number | null;
  cs_per_minute: number | null;
  gold_diff_at_10: number | null;
  xp_diff_at_10: number | null;
  cs_diff_at_10: number | null;
  gold_diff_at_15: number | null;
  xp_diff_at_15: number | null;
  cs_diff_at_15: number | null;
  item0: number | null;
  item1: number | null;
  item2: number | null;
  item3: number | null;
  item4: number | null;
  item5: number | null;
  item6: number | null;
  spell0: number | null;
  spell1: number | null;
  rune0: number | null;
  rune1: number | null;
  role_bound_item?: number | null;
  full_rune_names: string[] | null;
};

type BuildEventRow = {
  id: string;
  set_id: string;
  player_id: string;
  timestamp_ms: number;
  minute: number;
  event_type: ChampionBuildEvent["eventType"];
  raw_event_json: Record<string, unknown> | null;
};

export type ChampionPagePlayerStatLine = PlayerStatLine & {
  side: "blue" | "red" | null;
  wardsPlaced: number;
  wardsKilled: number;
};

export type ChampionBuildEvent = {
  setId: string;
  playerId: string;
  timestampMs: number;
  minute: number;
  eventType: "ITEM_PURCHASED" | "ITEM_SOLD" | "ITEM_UNDO" | "SKILL_LEVEL_UP";
  itemId: number | null;
  beforeItemId: number | null;
  afterItemId: number | null;
  skillSlot: number | null;
  levelUpType: string | null;
};

/** Directly assignable to ChampionAnalysisInput; buildEvents is an optional extra consumer. */
export type ChampionPageData = {
  champions: Champion[];
  players: Player[];
  teams: Team[];
  tournaments: Tournament[];
  matches: Match[];
  sets: SetResult[];
  pickBans: SetPickBan[];
  playerStats: ChampionPagePlayerStatLine[];
  buildEvents: ChampionBuildEvent[];
};

export type ChampionPageReferenceData = Pick<
  ChampionPageData,
  "champions" | "players" | "teams" | "tournaments" | "matches" | "sets"
>;

async function collectPages<Row extends { id: string }>(
  readPage: (afterId: string | null) => Promise<Row[]>,
): Promise<Row[]> {
  const rows: Row[] = [];
  let afterId: string | null = null;

  while (true) {
    const page = await readPage(afterId);
    if (page.length === 0) break;
    rows.push(...page);

    const nextAfterId = page.at(-1)?.id ?? null;
    if (!nextAfterId || nextAfterId === afterId) {
      throw new Error("Champion page pagination did not advance.");
    }
    afterId = nextAfterId;
  }

  return rows;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function chunksOf<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function mapWithConcurrency<Input, Output>(
  values: readonly Input[],
  concurrency: number,
  mapper: (value: Input) => Promise<Output>,
): Promise<Output[]> {
  const output = new Array<Output>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      output[index] = await mapper(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return output;
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    logoUrl: row.logo_url ?? "",
    logoWhiteUrl: row.logo_white_url ?? "",
    useWhiteLogoOnDark: row.use_white_logo_on_dark ?? false,
    profileImageUrl: row.profile_image_url ?? "",
    backgroundUrl: row.background_url ?? "",
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    fanSiteHost: row.fan_site_host ?? "",
    officialHomepageUrl: row.official_homepage_url ?? "",
    officialYoutubeUrl: row.official_youtube_url ?? "",
    officialXUrl: row.official_x_url ?? "",
    officialInstagramUrl: row.official_instagram_url ?? "",
    leaguepediaPage: row.leaguepedia_page ?? "",
    sourceTeamId: row.source_team_id ?? "",
    isLckTeam: row.is_lck_team ?? true,
    importedScope: row.imported_scope ?? "lck",
    isActive: row.is_active ?? true,
    headCoach: row.head_coach ?? null,
    coaches: row.coaches ?? null,
    globalPowerRank: row.global_power_rank ?? null,
    popularity: row.popularity ?? 0,
    searchAliases: row.search_aliases ?? [],
  };
}

function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    realName: row.real_name ?? "",
    teamId: row.team_id ?? "",
    position: row.position,
    profileImageUrl: row.profile_image_url ?? "",
    streamUrl: row.stream_url ?? undefined,
    twitterUrl: row.twitter_url ?? undefined,
    instagramUrl: row.instagram_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    facebookUrl: row.facebook_url ?? undefined,
    discordUrl: row.discord_url ?? undefined,
    soloQueueAccount: row.solo_queue_account ?? undefined,
    contractExpiry: row.contract_expiry ?? null,
    isStarter: row.is_starter ?? false,
    isLckPlayer: row.is_lck_player ?? true,
    importedScope: row.imported_scope ?? "lck",
    isActive: row.is_active ?? true,
    retiredAt: row.retired_at ?? null,
    leaguepediaPage: row.leaguepedia_page ?? undefined,
    sourcePlayerId: row.source_player_id ?? undefined,
    searchAliases: row.search_aliases ?? [],
  };
}

function mapChampion(row: ChampionRow): Champion {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.image_url ?? undefined,
    ddragonId: row.ddragon_id ?? undefined,
    ddragonKey: row.ddragon_key ?? undefined,
    ddragonVersion: row.ddragon_version ?? undefined,
  };
}

function mapTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    name: row.name,
    season: row.season,
    category: row.category,
    split: row.split ?? null,
    region: row.region ?? null,
    league: row.league ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    source: row.source ?? null,
    sourceTournamentId: row.source_tournament_id ?? null,
  };
}

function mapMatch(row: MatchRow): Match {
  return {
    id: row.id,
    tournamentId: row.tournament_id ?? "",
    stageId: row.stage_id ?? "",
    name: row.name,
    matchDate: row.match_date,
    status: row.status,
    teamAId: row.team_a_id ?? "",
    teamBId: row.team_b_id ?? "",
    teamAScore: row.team_a_score,
    teamBScore: row.team_b_score,
    bestOf: row.best_of,
    winnerTeamId: row.winner_team_id,
    officialPomPlayerId: null,
    leaguepediaMatchId: null,
    lolesportsMatchId: null,
    venue: null,
    vodUrl: null,
    bracketSide: null,
    bracketOrder: null,
    advancesToMatchId: null,
    groupIndex: 0,
  };
}

function mapSet(row: SetRow): SetResult {
  return {
    id: row.id,
    matchId: row.match_id,
    setNumber: row.set_number,
    status: normalizeSetStatus(row.status),
    winnerTeamId: row.winner_team_id,
    resultRecordedAt: row.result_recorded_at,
    blueTeamId: row.blue_team_id ?? "",
    redTeamId: row.red_team_id ?? "",
    durationSeconds: row.duration_seconds,
    blueKills: null,
    redKills: null,
    blueGold: null,
    redGold: null,
    blueDragons: null,
    redDragons: null,
    blueClouds: null,
    redClouds: null,
    blueInfernals: null,
    redInfernals: null,
    blueMountains: null,
    redMountains: null,
    blueOceans: null,
    redOceans: null,
    blueHextechs: null,
    redHextechs: null,
    blueChemtechs: null,
    redChemtechs: null,
    blueElders: null,
    redElders: null,
    blueRiftHeralds: null,
    redRiftHeralds: null,
    blueVoidGrubs: null,
    redVoidGrubs: null,
    blueBarons: null,
    redBarons: null,
    blueTowers: null,
    redTowers: null,
    patch: row.patch,
    leaguepediaGameId: null,
    riotMatchId: null,
    riotPlatformGameId: null,
  };
}

type AnalyzablePickBanRow = PickBanRow & {
  champion_id: string;
  side: SetPickBan["side"];
};

function mapPickBan(row: AnalyzablePickBanRow): SetPickBan {
  return {
    id: row.id,
    setId: row.set_id,
    phase: row.phase,
    actionType: row.action_type,
    orderIndex: row.order_index,
    teamId: row.team_id ?? "",
    championId: row.champion_id,
    side: row.side,
  };
}

function hasCompletePickBanFields(
  row: PickBanRow,
): row is AnalyzablePickBanRow {
  // Historical imports can lack a resolved team UUID while retaining a reliable side.
  // Champion and side are the fields required by the page's draft calculations.
  return Boolean(row.champion_id && row.side);
}

function numericEventField(
  raw: Record<string, unknown> | null,
  camelName: string,
  snakeName: string,
): number | null {
  const candidate = raw?.[camelName] ?? raw?.[snakeName];
  if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  if (typeof candidate === "string" && /^\d+$/.test(candidate)) return Number(candidate);
  return null;
}

function reportsMissingColumn(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const message = [record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase("en-US");
  return (record.code === "42703" || record.code === "PGRST204") && message.includes(column);
}

async function queryTeamsPage(afterId: string | null): Promise<TeamRow[]> {
  if (!canQuerySupabase()) return [];
  let query = createSupabaseServerClient()
    .from("teams")
    .select(TEAM_COLUMNS)
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);
  if (afterId) query = query.gt("id", afterId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as TeamRow[];
}

async function queryPlayersPage(afterId: string | null): Promise<PlayerRow[]> {
  if (!canQuerySupabase()) return [];
  let query = createSupabaseServerClient()
    .from("players")
    .select(PLAYER_COLUMNS)
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);
  if (afterId) query = query.gt("id", afterId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PlayerRow[];
}

async function queryChampionsPage(afterId: string | null): Promise<ChampionRow[]> {
  if (!canQuerySupabase()) return [];
  let query = createSupabaseServerClient()
    .from("champions")
    .select(CHAMPION_COLUMNS)
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);
  if (afterId) query = query.gt("id", afterId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ChampionRow[];
}

async function queryTournamentsPage(afterId: string | null): Promise<TournamentRow[]> {
  if (!canQuerySupabase()) return [];
  let query = createSupabaseServerClient()
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);
  if (afterId) query = query.gt("id", afterId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as TournamentRow[];
}

async function queryMatchesPage(afterId: string | null): Promise<MatchRow[]> {
  if (!canQuerySupabase()) return [];
  let query = createSupabaseServerClient()
    .from("matches")
    .select(MATCH_COLUMNS)
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);
  if (afterId) query = query.gt("id", afterId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as MatchRow[];
}

async function querySetsPage(afterId: string | null): Promise<SetRow[]> {
  if (!canQuerySupabase()) return [];
  let query = createSupabaseServerClient()
    .from("sets")
    .select(SET_COLUMNS)
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);
  if (afterId) query = query.gt("id", afterId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as SetRow[];
}

async function queryPickBansPage(
  setIds: string[],
  afterId: string | null,
): Promise<PickBanRow[]> {
  if (!canQuerySupabase() || setIds.length === 0) return [];
  let query = createSupabaseServerClient()
    .from("set_picks_bans")
    .select(PICK_BAN_COLUMNS)
    .in("set_id", setIds)
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);
  if (afterId) query = query.gt("id", afterId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PickBanRow[];
}

async function queryPlayerStatsPage(
  setIds: string[],
  afterId: string | null,
): Promise<PlayerStatRow[]> {
  if (!canQuerySupabase() || setIds.length === 0) return [];

  async function readPage(columns: string) {
    let query = createSupabaseServerClient()
      .from("set_player_stats")
      .select(columns)
      .in("set_id", setIds)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (afterId) query = query.gt("id", afterId);
    return query;
  }

  let { data, error } = await readPage(PLAYER_STAT_COLUMNS);
  if (reportsMissingColumn(error, "role_bound_item")) {
    ({ data, error } = await readPage(PLAYER_STAT_COLUMNS_WITHOUT_ROLE_BOUND_ITEM));
  }
  if (error) throw error;
  return (data ?? []) as unknown as PlayerStatRow[];
}

async function queryBuildEventsPage(
  setIds: string[],
  playerIds: string[],
  afterId: string | null,
): Promise<BuildEventRow[]> {
  if (!canQuerySupabase() || setIds.length === 0) return [];

  let query = createSupabaseServerClient()
    .from("timeline_events")
    .select(BUILD_EVENT_COLUMNS)
    .in("set_id", setIds)
    .in("event_type", ["ITEM_PURCHASED", "ITEM_SOLD", "ITEM_UNDO", "SKILL_LEVEL_UP"])
    .not("player_id", "is", null)
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);

  if (playerIds.length > 0) query = query.in("player_id", playerIds);
  if (afterId) query = query.gt("id", afterId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as BuildEventRow[];
}

const queryTeamsPageCached = unstable_cache(
  queryTeamsPage,
  ["champion-page-teams-page-v1"],
  CACHE_OPTIONS,
);
const queryPlayersPageCached = unstable_cache(
  queryPlayersPage,
  ["champion-page-players-page-v1"],
  CACHE_OPTIONS,
);
const queryChampionsPageCached = unstable_cache(
  queryChampionsPage,
  ["champion-page-champions-page-v1"],
  CACHE_OPTIONS,
);
const queryTournamentsPageCached = unstable_cache(
  queryTournamentsPage,
  ["champion-page-tournaments-page-v1"],
  CACHE_OPTIONS,
);
const queryMatchesPageCached = unstable_cache(
  queryMatchesPage,
  ["champion-page-matches-page-v1"],
  CACHE_OPTIONS,
);
const querySetsPageCached = unstable_cache(
  querySetsPage,
  ["champion-page-sets-page-v1"],
  CACHE_OPTIONS,
);
const queryPickBansPageCached = unstable_cache(
  queryPickBansPage,
  ["champion-page-pick-bans-page-v1"],
  CACHE_OPTIONS,
);
const queryPlayerStatsPageCached = unstable_cache(
  queryPlayerStatsPage,
  ["champion-page-player-stats-page-v1"],
  CACHE_OPTIONS,
);
const queryBuildEventsPageCached = unstable_cache(
  queryBuildEventsPage,
  ["champion-page-build-events-page-v2"],
  CACHE_OPTIONS,
);

async function getChampionPageReferenceDataBase(): Promise<ChampionPageReferenceData> {
  const [teamRows, playerRows, championRows, tournamentRows, matchRows, setRows] =
    await Promise.all([
      collectPages(queryTeamsPageCached),
      collectPages(queryPlayersPageCached),
      collectPages(queryChampionsPageCached),
      collectPages(queryTournamentsPageCached),
      collectPages(queryMatchesPageCached),
      collectPages(querySetsPageCached),
    ]);

  return {
    teams: teamRows.map(mapTeam).sort((a, b) => a.name.localeCompare(b.name, "ko")),
    players: playerRows.map(mapPlayer).sort((a, b) => a.name.localeCompare(b.name, "ko")),
    champions: championRows
      .map(mapChampion)
      .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    tournaments: tournamentRows
      .map(mapTournament)
      .sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999")),
    matches: matchRows.map(mapMatch),
    sets: setRows.map(mapSet),
  };
}

/** Small/reference entities plus match/set scope metadata; all underlying pages are shared-cache backed. */
export const getChampionPageReferenceData = cache(getChampionPageReferenceDataBase);

async function getChampionBySlugBase(slug: string): Promise<Champion | null> {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // A malformed route segment is simply not a known champion; do not turn it into a 500.
  }
  const normalized = decoded.trim().toLocaleLowerCase("en-US");
  if (!normalized) return null;
  const { champions } = await getChampionPageReferenceData();
  return (
    champions.find(
      (champion) => champion.slug.toLocaleLowerCase("en-US") === normalized,
    ) ?? null
  );
}

export const getChampionBySlug = cache(getChampionBySlugBase);

async function getPickBansForSets(setIds: readonly string[]): Promise<SetPickBan[]> {
  const idChunks = chunksOf(uniqueSorted(setIds), SET_ID_CHUNK_SIZE);
  const pages = await mapWithConcurrency(idChunks, MAX_PARALLEL_CHUNKS, (ids) =>
    collectPages((afterId) => queryPickBansPageCached(ids, afterId)),
  );
  // Missing champion/side identities must make the containing set incomplete instead
  // of being fabricated as a blue-side action. A team id is not required when side exists.
  return pages.flat().filter(hasCompletePickBanFields).map(mapPickBan);
}

function mapPlayerStats(rows: PlayerStatRow[], sets: readonly SetResult[]) {
  const setById = new Map(sets.map((set) => [set.id, set]));
  const teamKills = new Map<string, number>();
  const teamDamage = new Map<string, number>();

  for (const row of rows) {
    const key = `${row.set_id}:${row.team_id}`;
    teamKills.set(key, (teamKills.get(key) ?? 0) + (row.kills ?? 0));
    teamDamage.set(
      key,
      (teamDamage.get(key) ?? 0) + (row.damage_to_champions ?? 0),
    );
  }

  return rows.map<ChampionPagePlayerStatLine>((row) => {
    const key = `${row.set_id}:${row.team_id}`;
    const set = setById.get(row.set_id);
    return {
      setId: row.set_id,
      playerId: row.player_id,
      teamId: row.team_id,
      side: row.side,
      position: row.position,
      championId: row.champion_id,
      championLevel: row.champion_level,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      cs: row.cs,
      gold: row.gold,
      damageToChampions: row.damage_to_champions,
      teamKills: teamKills.get(key) ?? 0,
      teamDamage: teamDamage.get(key) ?? 0,
      gameMinutes: (set?.durationSeconds ?? 0) / 60,
      visionScore: row.vision_score,
      visionScoreAverage: null,
      wardsPlaced: row.wards_placed,
      wardsKilled: row.wards_killed,
      dpm: row.dpm,
      damageShare: row.damage_share,
      visionScorePerMinute: row.vision_score_per_minute,
      csPerMinute: row.cs_per_minute,
      goldDiffAt10: row.gold_diff_at_10,
      xpDiffAt10: row.xp_diff_at_10,
      csDiffAt10: row.cs_diff_at_10,
      goldDiffAt15: row.gold_diff_at_15,
      xpDiffAt15: row.xp_diff_at_15,
      csDiffAt15: row.cs_diff_at_15,
      itemIds: [
        row.item0,
        row.item1,
        row.item2,
        row.item3,
        row.item4,
        row.item5,
        row.item6,
      ],
      spellIds: [row.spell0, row.spell1],
      runeIds: [row.rune0, row.rune1],
      roleBoundItem: row.role_bound_item ?? null,
      fullRuneNames: row.full_rune_names,
      patch: set?.patch ?? null,
    };
  });
}

async function getPlayerStatsForSets(
  setIds: readonly string[],
  sets: readonly SetResult[],
): Promise<ChampionPagePlayerStatLine[]> {
  const idChunks = chunksOf(uniqueSorted(setIds), SET_ID_CHUNK_SIZE);
  const pages = await mapWithConcurrency(idChunks, MAX_PARALLEL_CHUNKS, (ids) =>
    collectPages((afterId) => queryPlayerStatsPageCached(ids, afterId)),
  );
  return mapPlayerStats(pages.flat(), sets);
}

/**
 * Bulk item-event loader. It queries set/player chunks rather than one request per game,
 * and maps the large raw JSON payload down to the item id needed by the page.
 */
export async function getChampionBuildEvents(
  setIds: readonly string[],
  playerIds: readonly string[] = [],
): Promise<ChampionBuildEvent[]> {
  const setChunks = chunksOf(uniqueSorted(setIds), BUILD_EVENT_SET_ID_CHUNK_SIZE);
  if (setChunks.length === 0) return [];

  const normalizedPlayerIds = uniqueSorted(playerIds);
  const playerChunks =
    normalizedPlayerIds.length > 0
      ? chunksOf(normalizedPlayerIds, PLAYER_ID_CHUNK_SIZE)
      : [[]];
  const pairs = setChunks.flatMap((setChunk) =>
    playerChunks.map((playerChunk) => ({ setChunk, playerChunk })),
  );

  const pageGroups = await mapWithConcurrency(
    pairs,
    MAX_PARALLEL_CHUNKS,
    ({ setChunk, playerChunk }) =>
      collectPages((afterId) =>
        queryBuildEventsPageCached(setChunk, playerChunk, afterId),
      ),
  );

  return pageGroups
    .flat()
    .map<ChampionBuildEvent>((row) => ({
      setId: row.set_id,
      playerId: row.player_id,
      timestampMs: row.timestamp_ms,
      minute: row.minute,
      eventType: row.event_type,
      itemId: numericEventField(row.raw_event_json, "itemId", "item_id"),
      beforeItemId: numericEventField(row.raw_event_json, "beforeId", "before_id"),
      afterItemId: numericEventField(row.raw_event_json, "afterId", "after_id"),
      skillSlot: numericEventField(row.raw_event_json, "skillSlot", "skill_slot"),
      levelUpType: typeof row.raw_event_json?.levelUpType === "string"
        ? row.raw_event_json.levelUpType
        : typeof row.raw_event_json?.level_up_type === "string"
          ? row.raw_event_json.level_up_type
          : null,
    }))
    .sort(
      (a, b) =>
        a.setId.localeCompare(b.setId) ||
        a.timestampMs - b.timestampMs ||
        a.playerId.localeCompare(b.playerId),
    );
}

async function getChampionPageDataBase(
  setIds: readonly string[],
): Promise<ChampionPageData> {
  const references = await getChampionPageReferenceData();
  const normalizedSetIds = uniqueSorted(setIds);
  const scopedSetIdSet = new Set(normalizedSetIds);
  const sets = references.sets.filter((set) => scopedSetIdSet.has(set.id));

  const [pickBans, playerStats] = await Promise.all([
    getPickBansForSets(normalizedSetIds),
    getPlayerStatsForSets(normalizedSetIds, sets),
  ]);

  const matchIds = new Set(sets.map((set) => set.matchId));
  const matches = references.matches.filter((match) => matchIds.has(match.id));
  const tournamentIds = new Set(matches.map((match) => match.tournamentId));

  return {
    champions: references.champions,
    players: references.players,
    teams: references.teams,
    tournaments: references.tournaments.filter((tournament) =>
      tournamentIds.has(tournament.id),
    ),
    matches,
    sets,
    pickBans,
    playerStats,
    buildEvents: [],
  };
}

/** Directory/overview facts for already-resolved set ids. No timeline payload is loaded. */
export const getChampionPageData = cache(getChampionPageDataBase);
export const getChampionDirectoryData = getChampionPageData;

async function getChampionDetailDataBase(
  championId: string,
  setIds: readonly string[],
): Promise<ChampionPageData> {
  const data = await getChampionPageData(setIds);
  const targetRows = data.playerStats.filter((row) => row.championId === championId);
  const targetPairs = new Set(targetRows.map((row) => `${row.setId}:${row.playerId}`));

  // Restrict the costly timeline scan to sets and players that actually used this champion.
  const buildEvents = await getChampionBuildEvents(
    targetRows.map((row) => row.setId),
    targetRows.map((row) => row.playerId),
  );

  return {
    ...data,
    buildEvents: buildEvents.filter((event) =>
      targetPairs.has(`${event.setId}:${event.playerId}`),
    ),
  };
}

export const getChampionDetailData = cache(getChampionDetailDataBase);

export type ChampionScopeInput = {
  season?: number | string | null;
  segment?: SeasonSegmentKey | "all" | string | null;
  /** Group key, a legacy individual tournament id, or "all". */
  tournament?: string | null;
  tournamentId?: string | null;
  patch?: string | null;
};

export type ChampionTournamentOption = {
  /** Stable query value shared by duplicate rows with the same normalized name. */
  key: string;
  name: string;
  tournamentIds: string[];
  sourceCount: number;
  startDate: string | null;
  endDate: string | null;
};

export type ChampionSegmentOption = {
  key: SeasonSegmentKey | "all";
  label: string;
  tournamentCount: number;
};

export type ResolvedChampionScope = {
  normalized: {
    season: number;
    segment: SeasonSegmentKey | "all";
    tournament: string | "all";
    patch: string | "all";
  };
  season: number;
  segment: SeasonSegmentKey | "all";
  tournament: string | "all";
  patch: string | "all";
  tournamentIds: string[];
  matchIds: string[];
  setIds: string[];
  options: {
    seasons: number[];
    segments: ChampionSegmentOption[];
    tournaments: ChampionTournamentOption[];
    patches: string[];
  };
  counts: {
    tournaments: number;
    matches: number;
    sets: number;
  };
};

function normalizedTournamentName(name: string) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function tournamentGroupKey(name: string) {
  // URLSearchParams safely encodes spaces/non-ASCII while this remains stable and collision-free.
  return `name:${normalizedTournamentName(name)}`;
}

function buildTournamentOptions(tournaments: readonly Tournament[]): ChampionTournamentOption[] {
  const groups = new Map<string, Tournament[]>();
  for (const tournament of tournaments) {
    const key = tournamentGroupKey(tournament.name);
    const group = groups.get(key) ?? [];
    group.push(tournament);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const ordered = [...group].sort(
        (a, b) =>
          (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999") ||
          a.id.localeCompare(b.id),
      );
      const starts = ordered.map((item) => item.startDate).filter((date): date is string => !!date);
      const ends = ordered.map((item) => item.endDate).filter((date): date is string => !!date);
      return {
        key,
        name: ordered[0]?.name ?? "",
        tournamentIds: ordered.map((item) => item.id),
        sourceCount: ordered.length,
        startDate: starts[0] ?? null,
        endDate: ends.sort().at(-1) ?? null,
      };
    })
    .sort(
      (a, b) =>
        (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999") ||
        a.name.localeCompare(b.name, "ko"),
    );
}

function comparePatchesDescending(left: string, right: string) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (rightParts[index] ?? -1) - (leftParts[index] ?? -1);
    if (Number.isFinite(difference) && difference !== 0) return difference;
  }
  return right.localeCompare(left, undefined, { numeric: true });
}

function parsedSeason(value: ChampionScopeInput["season"], validSeasons: readonly number[]) {
  const requested = typeof value === "number" ? value : Number(value);
  return Number.isInteger(requested) && validSeasons.includes(requested)
    ? requested
    : (validSeasons[0] ?? new Date().getUTCFullYear());
}

/**
 * Pure scope resolver used by server pages before loading the large fact tables.
 * Duplicate tournament records with the same normalized display name become one option
 * whose selection includes every source row, preventing accidental split statistics.
 */
export function resolveChampionScope(
  data: Pick<ChampionPageReferenceData, "tournaments" | "matches" | "sets">,
  input: ChampionScopeInput = {},
): ResolvedChampionScope {
  const seasons = [...new Set(data.tournaments.map((tournament) => tournament.season))].sort(
    (a, b) => b - a,
  );
  const season = parsedSeason(input.season, seasons);
  const seasonTournaments = data.tournaments.filter(
    (tournament) => tournament.season === season,
  );

  const availableSegmentKeys = new Set(
    seasonTournaments
      .map((tournament) => segmentForTournament(tournament))
      .filter((key): key is SeasonSegmentKey => key !== null),
  );
  const requestedSegment =
    typeof input.segment === "string" &&
    input.segment !== "all" &&
    availableSegmentKeys.has(input.segment as SeasonSegmentKey)
      ? (input.segment as SeasonSegmentKey)
      : "all";
  const segmentTournaments =
    requestedSegment === "all"
      ? seasonTournaments
      : seasonTournaments.filter(
          (tournament) => segmentForTournament(tournament) === requestedSegment,
        );

  const tournamentOptions = buildTournamentOptions(segmentTournaments);
  const requestedTournament = (input.tournament ?? input.tournamentId ?? "all").trim();
  const selectedTournamentOption =
    requestedTournament === "all"
      ? null
      : tournamentOptions.find(
          (option) =>
            option.key === requestedTournament ||
            option.name === requestedTournament ||
            option.tournamentIds.includes(requestedTournament),
        ) ?? null;
  const tournament = selectedTournamentOption?.key ?? "all";
  const tournamentIds = selectedTournamentOption
    ? selectedTournamentOption.tournamentIds
    : segmentTournaments.map((item) => item.id);
  const tournamentIdSet = new Set(tournamentIds);
  const prePatchMatches = data.matches.filter((match) =>
    tournamentIdSet.has(match.tournamentId),
  );
  const prePatchMatchIdSet = new Set(prePatchMatches.map((match) => match.id));
  const prePatchSets = data.sets.filter((set) => prePatchMatchIdSet.has(set.matchId));
  const patches = [...new Set(prePatchSets.map((set) => set.patch?.trim()).filter(Boolean))]
    .filter((patch): patch is string => typeof patch === "string")
    .sort(comparePatchesDescending);
  const requestedPatch = input.patch?.trim() ?? "all";
  const patch = requestedPatch !== "all" && patches.includes(requestedPatch) ? requestedPatch : "all";
  const sets =
    patch === "all"
      ? prePatchSets
      : prePatchSets.filter((set) => set.patch?.trim() === patch);
  const finalMatchIdSet = new Set(sets.map((set) => set.matchId));
  const matches = prePatchMatches.filter((match) => finalMatchIdSet.has(match.id));

  const segmentOptions: ChampionSegmentOption[] = [
    {
      key: "all",
      label: segmentLabel("all", season),
      tournamentCount: buildTournamentOptions(seasonTournaments).length,
    },
    ...SEASON_2026_SEGMENTS.filter(
      (option): option is (typeof SEASON_2026_SEGMENTS)[number] & { key: SeasonSegmentKey } =>
        option.key !== "all" && availableSegmentKeys.has(option.key),
    ).map((option) => ({
      key: option.key,
      label: segmentLabel(option.key, season),
      tournamentCount: buildTournamentOptions(
        seasonTournaments.filter((item) => segmentForTournament(item) === option.key),
      ).length,
    })),
  ];

  return {
    normalized: { season, segment: requestedSegment, tournament, patch },
    season,
    segment: requestedSegment,
    tournament,
    patch,
    tournamentIds: uniqueSorted(tournamentIds),
    matchIds: matches.map((match) => match.id),
    setIds: sets.map((set) => set.id),
    options: { seasons, segments: segmentOptions, tournaments: tournamentOptions, patches },
    counts: {
      tournaments: selectedTournamentOption ? 1 : tournamentOptions.length,
      matches: matches.length,
      sets: sets.length,
    },
  };
}
