import type { SupabaseClient } from "@supabase/supabase-js";

import { championCatalogEntryForValue } from "../champions.ts";
import { ddragonVersionFromPatch, uniqueDdragonVersionsForPatches } from "../ddragon.ts";
import { fetchItemCatalog } from "../items.ts";
import { reconcileMatchFromSets } from "../match-reconcile.ts";
import { fetchRuneNameToIdMap } from "../runes.ts";
import { deriveSetStatus, hasCompletePlayerStats } from "../set-status.ts";
import { fetchSpellCatalog, type GameSpell } from "../spells.ts";
import {
  resolveLeaguepediaIdentity,
  type LeaguepediaAlias,
} from "../leaguepedia-identity.ts";
import { fetchAuthenticatedLeaguepediaApi } from "./leaguepedia-api.ts";
import { resolveLeaguepediaPickBanRows } from "./leaguepedia-pick-ban.ts";

const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 8;

type MatchTeamRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  leaguepedia_page: string | null;
  source_team_id?: string | null;
  is_lck_team?: boolean | null;
};

type MatchRow = {
  id: string;
  leaguepedia_match_id: string | null;
  best_of: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a: MatchTeamRow | null;
  team_b: MatchTeamRow | null;
  team_aliases?: LeaguepediaAlias[];
  tournament: { league: string | null } | null;
};

type CargoSetRow = {
  GameId?: string;
  N_GameInMatch?: string;
  Team1?: string;
  Team2?: string;
  WinTeam?: string;
  Team1Score?: string;
  Team2Score?: string;
  Winner?: string;
  Gamelength?: string;
  Team1Gold?: string;
  Team2Gold?: string;
  Team1Kills?: string;
  Team2Kills?: string;
  Team1Dragons?: string;
  Team2Dragons?: string;
  Team1Clouds?: string;
  Team2Clouds?: string;
  Team1Infernals?: string;
  Team2Infernals?: string;
  Team1Mountains?: string;
  Team2Mountains?: string;
  Team1Oceans?: string;
  Team2Oceans?: string;
  Team1Hextechs?: string;
  Team2Hextechs?: string;
  Team1Chemtechs?: string;
  Team2Chemtechs?: string;
  Team1Elders?: string;
  Team2Elders?: string;
  Team1RiftHeralds?: string;
  Team2RiftHeralds?: string;
  Team1VoidGrubs?: string;
  Team2VoidGrubs?: string;
  Team1Barons?: string;
  Team2Barons?: string;
  Team1Towers?: string;
  Team2Towers?: string;
  Patch?: string;
  RiotPlatformGameId?: string;
  RiotGameId?: string;
  Team1Bans?: string;
  Team2Bans?: string;
  Team1Picks?: string;
  Team2Picks?: string;
};

type CargoPickBanRow = {
  GameId?: string;
  N_GameInMatch?: string;
  Team1?: string;
  Team2?: string;
  Team1Ban1?: string;
  Team1Ban2?: string;
  Team1Ban3?: string;
  Team1Ban4?: string;
  Team1Ban5?: string;
  Team2Ban1?: string;
  Team2Ban2?: string;
  Team2Ban3?: string;
  Team2Ban4?: string;
  Team2Ban5?: string;
  Team1Pick1?: string;
  Team1Pick2?: string;
  Team1Pick3?: string;
  Team1Pick4?: string;
  Team1Pick5?: string;
  Team2Pick1?: string;
  Team2Pick2?: string;
  Team2Pick3?: string;
  Team2Pick4?: string;
  Team2Pick5?: string;
};

type CargoPlayerRow = {
  GameId?: string;
  Link?: string;
  Champion?: string;
  Kills?: string;
  Deaths?: string;
  Assists?: string;
  Gold?: string;
  CS?: string;
  DamageToChampions?: string;
  VisionScore?: string;
  Team?: string;
  Role?: string;
  Side?: string;
  Items?: string;
  SummonerSpells?: string;
  Trinket?: string;
  RoleBoundItem?: string;
  KeystoneRune?: string;
  SecondaryTree?: string;
};

type PreservedPlayerBuild = {
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
  role_bound_item: number | null;
};

type CargoScheduleGameRow = {
  ScheduleGameId?: string;
  N_GameInMatch?: string;
  Blue?: string;
  Red?: string;
  SideWinner?: string;
};

type MergedCargoSetRow = CargoSetRow & CargoScheduleGameRow;

const TEAM_ALIASES = new Map([
  ["t1", "t1"],
  ["gen.g", "geng"],
  ["gen", "geng"],
  ["geng", "geng"],
  ["hanwha life esports", "hle"],
  ["hanwha life", "hle"],
  ["hle", "hle"],
  ["dplus kia", "dk"],
  ["dplus", "dk"],
  ["dk", "dk"],
  ["kt rolster", "kt"],
  ["kt", "kt"],
  ["nongshim redforce", "ns"],
  ["nongshim", "ns"],
  ["ns", "ns"],
  ["kiwoom drx", "drx"],
  ["drx", "drx"],
  ["hanjin brion", "bro"],
  ["brion", "bro"],
  ["bro", "bro"],
  ["bnk fearx", "fox"],
  ["fearx", "fox"],
  ["bfx", "fox"],
  ["fox", "fox"],
  ["dn soopers", "soop"],
  ["dn freecs", "soop"],
  ["kwangdong freecs", "soop"],
  ["dns", "soop"],
  ["soop", "soop"],
]);

export type LeaguepediaMatchSetsSyncSummary = {
  matchId: string;
  leaguepediaMatchId: string;
  fetched: number;
  upserted: number;
  picksBansUpserted: number;
  playerStatsUpserted: number;
  itemsResolved: number;
  spellsResolved: number;
  runesResolved: number;
};

export class LeaguepediaRateLimitError extends Error {
  constructor(message = "Leaguepedia rate limit") {
    super(message);
    this.name = "LeaguepediaRateLimitError";
  }
}

type LeaguepediaSyncOptions = { maxRetries?: number; refreshAiPreview?: boolean };

function sleep(ms: number) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

import {
  displayNameFromLeaguepediaPage,
  leaguepediaSourcePlayerId,
} from "../leaguepedia-player.ts";

async function buildItemNameToIdMap(version: string): Promise<Map<string, number>> {
  try {
    const items = await fetchItemCatalog(version, "en_US");
    return new Map(items.map((item) => [item.name.toLowerCase(), item.id]));
  } catch {
    return new Map();
  }
}

function buildSpellKeyToIdMap(spells: GameSpell[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const spell of spells) {
    map.set(spell.name.toLowerCase(), spell.id);
    const key = spell.imageName.replace(/\.png$/i, "");
    map.set(key.toLowerCase(), spell.id);
    const shortName = key.replace(/^Summoner/i, "").toLowerCase();
    if (shortName) map.set(shortName, spell.id);
  }
  return map;
}

function parseLeaguepediaItems(
  itemsStr: string | null | undefined,
  nameToId: Map<string, number>,
): (number | null)[] {
  if (!itemsStr?.trim()) return [];
  const parts = itemsStr.split(";").map((s) => s.trim());
  const result = parts.map((name) => (name ? (nameToId.get(name.toLowerCase()) ?? null) : null));
  while (result.length < 7) result.push(null);
  return result.slice(0, 7);
}

function parseLeaguepediaSpells(
  spellsStr: string | null | undefined,
  nameToId: Map<string, number>,
): (number | null)[] {
  if (!spellsStr?.trim()) return [null, null];
  const parts = spellsStr.split(",").map((s) => s.trim());
  return Array.from({ length: 2 }, (_, i) => {
    const name = parts[i];
    if (!name) return null;
    return nameToId.get(name.toLowerCase()) ?? nameToId.get(name.replace(/^Summoner/i, "").toLowerCase()) ?? null;
  });
}

function parseInteger(value: string | null | undefined) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugify(value: string) {
  return normalizeName(value)
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeChampionName(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function playerItemsKey(setId: string, playerId: string) {
  return `${setId}:${playerId}`;
}

function parseGold(value: string | null | undefined) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed < 1000 ? parsed * 1000 : parsed);
}

function parseDurationSeconds(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  const parts = text.split(":").map((part) => Number.parseInt(part, 10));

  if (parts.length === 2 && parts.every(Number.isFinite)) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  const numeric = Number.parseInt(text, 10);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveTeamId(
  value: string | null | undefined,
  match: MatchRow,
) {
  const normalized = normalizeName(value);
  const aliasedSlug = TEAM_ALIASES.get(normalized);
  const teams = [match.team_a, match.team_b].filter(
    (team): team is MatchTeamRow => Boolean(team),
  ).map((team) => ({ ...team, source_id: team.source_team_id }));
  if (aliasedSlug) {
    const aliased = teams.find((team) => team.slug === aliasedSlug);
    if (aliased) return aliased.id;
  }
  return resolveLeaguepediaIdentity(value, teams, match.team_aliases)?.id ?? null;
}

function numericWinnerTeamId(row: MergedCargoSetRow, match: MatchRow) {
  const winner = parseInteger(row.Winner);
  if (winner === 1) {
    return resolveTeamId(row.Team1, match);
  }
  if (winner === 2) {
    return resolveTeamId(row.Team2, match);
  }

  const sideWinner = parseInteger(row.SideWinner);
  if (sideWinner === 1) {
    return resolveTeamId(row.Blue, match);
  }
  if (sideWinner === 2) {
    return resolveTeamId(row.Red, match);
  }

  return null;
}

function winnerTeamId(row: MergedCargoSetRow, match: MatchRow) {
  return resolveTeamId(row.WinTeam, match) ?? numericWinnerTeamId(row, match);
}

function statForSide({
  sideTeamId,
  row,
  match,
  team1Value,
  team2Value,
}: {
  sideTeamId: string | null;
  row: CargoSetRow;
  match: MatchRow;
  team1Value: string | null | undefined;
  team2Value: string | null | undefined;
}) {
  if (!sideTeamId) {
    return null;
  }

  const team1Id = resolveTeamId(row.Team1, match);
  const team2Id = resolveTeamId(row.Team2, match);

  if (sideTeamId === team1Id) {
    return team1Value;
  }
  if (sideTeamId === team2Id) {
    return team2Value;
  }

  return null;
}

function parsedStatForSide(args: {
  sideTeamId: string | null;
  row: CargoSetRow;
  match: MatchRow;
  team1Value: string | null | undefined;
  team2Value: string | null | undefined;
}) {
  return parseInteger(statForSide(args));
}

function goldForSide(args: {
  sideTeamId: string | null;
  row: CargoSetRow;
  match: MatchRow;
  team1Value: string | null | undefined;
  team2Value: string | null | undefined;
}) {
  return parseGold(statForSide(args));
}

function roleToPosition(role: string | null | undefined) {
  const value = normalizeName(role);
  if (["top", "1"].includes(value)) return "TOP";
  if (["jungle", "jgl", "jng", "2"].includes(value)) return "JGL";
  if (["mid", "middle", "3"].includes(value)) return "MID";
  if (["bot", "bottom", "adc", "4"].includes(value)) return "BOT";
  if (["support", "sup", "5"].includes(value)) return "SUP";
  return null;
}

function sideLabel(value: string | null | undefined) {
  const normalized = normalizeName(value);
  if (normalized === "1" || normalized === "blue") return "blue";
  if (normalized === "2" || normalized === "red") return "red";
  return null;
}

type ExistingChampion = {
  id: string;
  slug: string;
  name: string;
  ddragon_id?: string | null;
};

type ExistingPlayer = {
  id: string;
  slug: string;
  name: string;
  team_id: string | null;
  position: string;
  leaguepedia_page?: string | null;
};

// 케스파컵은 2군 선수도 함께 출전하므로 여기서 처음 등장한 선수는 선수 목록에서 제외한다.
function isKespaCupMatch(match: MatchRow) {
  return match.tournament?.league === "KeSPA Cup";
}

function isLckTeamId(teamId: string | null, match: MatchRow) {
  if (!teamId) {
    return true;
  }

  if (match.team_a?.id === teamId) {
    return match.team_a.is_lck_team ?? true;
  }

  if (match.team_b?.id === teamId) {
    return match.team_b.is_lck_team ?? true;
  }

  return true;
}

async function getChampionMap(supabase: SupabaseClient, championNames: string[]) {
  const normalizedNames = Array.from(
    new Set(championNames.map(normalizeChampionName).filter(Boolean)),
  );

  const { data: existing, error } = await supabase
    .from("champions")
    .select("id, slug, name, ddragon_id");

  if (error) {
    throw error;
  }

  const byName = new Map<string, string>();

  function addChampionKeys(champion: ExistingChampion) {
    for (const value of [champion.ddragon_id, champion.slug, champion.name]) {
      if (!value) continue;
      byName.set(normalizeName(value), champion.id);

      const catalogEntry = championCatalogEntryForValue(value);
      if (catalogEntry) {
        byName.set(normalizeName(catalogEntry.ddragon_id), champion.id);
        byName.set(normalizeName(catalogEntry.slug), champion.id);
        byName.set(normalizeName(catalogEntry.name), champion.id);
      }
    }
  }

  for (const champion of existing as ExistingChampion[]) {
    addChampionKeys(champion);
  }

  const missing = normalizedNames.filter((name) => {
    const catalogEntry = championCatalogEntryForValue(name);
    return !byName.has(normalizeName(name)) && !byName.has(normalizeName(catalogEntry?.ddragon_id));
  });

  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("champions")
      .upsert(
        missing.map((name) => {
          const catalogEntry = championCatalogEntryForValue(name);
          return catalogEntry ?? {
            slug: slugify(name),
            name,
            ddragon_id: name.replace(/\s+/g, ""),
          };
        }),
        { onConflict: "slug" },
      )
      .select("id, slug, name, ddragon_id");

    if (insertError) {
      throw insertError;
    }

    for (const champion of inserted as ExistingChampion[]) {
      addChampionKeys(champion);
    }
  }

  return byName;
}

async function getPlayerMap(supabase: SupabaseClient) {
  const [{ data, error }, { data: aliasRows, error: aliasError }] = await Promise.all([
    supabase
      .from("players")
      .select("id, slug, name, team_id, position, leaguepedia_page"),
    supabase
      .from("leaguepedia_player_aliases")
      .select("player_id, page_name"),
  ]);

  if (error) {
    throw error;
  }
  if (aliasError) throw aliasError;

  const byName = new Map<string, ExistingPlayer>();
  const players = data as ExistingPlayer[];
  const byId = new Map(players.map((player) => [player.id, player]));
  for (const player of players) {
    byName.set(normalizeName(player.name), player);
    byName.set(normalizeName(player.slug), player);
    if (player.leaguepedia_page) {
      byName.set(normalizeName(player.leaguepedia_page), player);
      byName.set(normalizeName(displayNameFromLeaguepediaPage(player.leaguepedia_page)), player);
    }
  }
  for (const alias of aliasRows ?? []) {
    const player = byId.get(alias.player_id);
    if (!player) continue;
    byName.set(normalizeName(alias.page_name), player);
    byName.set(normalizeName(displayNameFromLeaguepediaPage(alias.page_name)), player);
  }
  return byName;
}

function playerForLeaguepediaLink(
  playerMap: Map<string, ExistingPlayer>,
  link: string | null | undefined,
) {
  const pageName = String(link ?? "").trim();
  const displayName = displayNameFromLeaguepediaPage(pageName);

  return (
    playerMap.get(normalizeName(pageName)) ??
    playerMap.get(normalizeName(displayName)) ??
    playerMap.get(normalizeName(slugify(displayName)))
  );
}

async function backfillLeaguepediaPages({
  supabase,
  playerMap,
  playerRows,
}: {
  supabase: SupabaseClient;
  playerMap: Map<string, ExistingPlayer>;
  playerRows: CargoPlayerRow[];
}) {
  const patches = new Map<string, { leaguepedia_page: string; source_player_id: string }>();

  for (const row of playerRows) {
    const leaguepediaPage = String(row.Link ?? "").trim();
    if (!leaguepediaPage) {
      continue;
    }

    const player = playerForLeaguepediaLink(playerMap, leaguepediaPage);
    if (!player?.id || player.leaguepedia_page?.trim() === leaguepediaPage) {
      continue;
    }

    patches.set(player.id, {
      leaguepedia_page: leaguepediaPage,
      source_player_id: leaguepediaSourcePlayerId(leaguepediaPage),
    });
  }

  for (const [id, patch] of patches) {
    const { error } = await supabase.from("players").update(patch).eq("id", id);
    if (error) {
      throw error;
    }
    const { error: aliasError } = await supabase
      .from("leaguepedia_player_aliases")
      .upsert(
        { player_id: id, page_name: patch.leaguepedia_page },
        { onConflict: "page_name", ignoreDuplicates: true },
      );
    if (aliasError) throw aliasError;

    const player = [...playerMap.values()].find((entry) => entry.id === id);
    if (!player) {
      continue;
    }

    player.leaguepedia_page = patch.leaguepedia_page;
    playerMap.set(normalizeName(patch.leaguepedia_page), player);
    playerMap.set(normalizeName(displayNameFromLeaguepediaPage(patch.leaguepedia_page)), player);
  }
}

async function ensurePlayersForStats({
  supabase,
  playerMap,
  playerRows,
  match,
  setByGameId,
}: {
  supabase: SupabaseClient;
  playerMap: Map<string, ExistingPlayer>;
  playerRows: CargoPlayerRow[];
  match: MatchRow;
  setByGameId: Map<string, {
    id: string;
    set_number: number;
    leaguepedia_game_id: string | null;
    duration_seconds: number | null;
    blue_team_id: string | null;
    red_team_id: string | null;
  }>;
}) {
  await backfillLeaguepediaPages({ supabase, playerMap, playerRows });

  const payloadBySlug = new Map<string, {
    slug: string;
    name: string;
    team_id: string | null;
    position: string;
    leaguepedia_page: string;
    source_player_id: string;
    is_lck_player: boolean;
    imported_scope: "lck" | "international_event" | "kespa_cup";
  }>();

  for (const row of playerRows) {
    const leaguepediaPage = String(row.Link ?? "").trim();
    const playerName = displayNameFromLeaguepediaPage(leaguepediaPage);
    const position = roleToPosition(row.Role);
    const set = setByGameId.get(row.GameId ?? "");
    if (!playerName || !position || !set || playerForLeaguepediaLink(playerMap, leaguepediaPage)) {
      continue;
    }

    const side = sideLabel(row.Side);
    const teamId =
      resolveTeamId(row.Team, match) ??
      (side === "blue" ? set.blue_team_id : side === "red" ? set.red_team_id : null);
    const slug = slugify(playerName);
    if (!slug) {
      continue;
    }

    payloadBySlug.set(slug, {
      slug,
      name: playerName,
      team_id: teamId,
      position,
      leaguepedia_page: leaguepediaPage,
      source_player_id: leaguepediaSourcePlayerId(leaguepediaPage),
      is_lck_player: isLckTeamId(teamId, match),
      imported_scope: !isLckTeamId(teamId, match)
        ? "international_event"
        : isKespaCupMatch(match)
          ? "kespa_cup"
          : "lck",
    });
  }

  const payload = Array.from(payloadBySlug.values());
  if (payload.length === 0) {
    return;
  }

  const { data, error } = await supabase
    .from("players")
    .upsert(payload, { onConflict: "slug" })
    .select("id, slug, name, team_id, position, leaguepedia_page");

  if (error) {
    throw error;
  }

  for (const player of data as ExistingPlayer[]) {
    playerMap.set(normalizeName(player.name), player);
    playerMap.set(normalizeName(player.slug), player);
    if (player.leaguepedia_page) {
      playerMap.set(normalizeName(player.leaguepedia_page), player);
      playerMap.set(normalizeName(displayNameFromLeaguepediaPage(player.leaguepedia_page)), player);
    }
  }
  const aliases = (data as ExistingPlayer[]).flatMap((player) =>
    player.leaguepedia_page
      ? [{ player_id: player.id, page_name: player.leaguepedia_page }]
      : []
  );
  if (aliases.length > 0) {
    const { error: aliasError } = await supabase
      .from("leaguepedia_player_aliases")
      .upsert(aliases, { onConflict: "page_name", ignoreDuplicates: true });
    if (aliasError) throw aliasError;
  }
}

function championIdFor(map: Map<string, string>, name: string | null | undefined) {
  const normalized = normalizeChampionName(name);
  const direct = map.get(normalizeName(normalized)) ?? map.get(normalizeName(normalized.replace(/\s+/g, "")));
  if (direct) return direct;
  const catalogEntry = championCatalogEntryForValue(name);
  if (catalogEntry) {
    return map.get(normalizeName(catalogEntry.ddragon_id)) ?? map.get(normalizeName(catalogEntry.slug)) ?? null;
  }
  return null;
}

function pickBanRowsForSet({
  setId,
  row,
  match,
  blueTeamId,
  redTeamId,
  championMap,
}: {
  setId: string;
  row: CargoPickBanRow;
  match: MatchRow;
  blueTeamId: string | null;
  redTeamId: string | null;
  championMap: Map<string, string>;
}) {
  const team1Id = resolveTeamId(row.Team1, match) ?? blueTeamId;
  const team2Id = resolveTeamId(row.Team2, match) ?? redTeamId;
  const sideForTeam = (teamId: string | null): "blue" | "red" =>
    teamId && teamId === blueTeamId ? "blue" : "red";
  const rows: Array<{
    set_id: string;
    phase: string;
    action_type: "pick" | "ban";
    order_index: number;
    team_id: string | null;
    champion_id: string;
    side: "blue" | "red";
  }> = [];
  const push = (
    phase: string,
    actionType: "pick" | "ban",
    orderIndex: number,
    teamId: string | null,
    side: "blue" | "red",
    championName: string | null | undefined,
  ) => {
    const championId = championIdFor(championMap, championName);
    if (!championId) return;
    rows.push({
      set_id: setId,
      phase,
      action_type: actionType,
      order_index: orderIndex,
      team_id: teamId,
      champion_id: championId,
      side,
    });
  };

  const banOrder = [
    ["ban1", 1, team1Id, sideForTeam(team1Id), row.Team1Ban1],
    ["ban1", 2, team2Id, sideForTeam(team2Id), row.Team2Ban1],
    ["ban1", 3, team1Id, sideForTeam(team1Id), row.Team1Ban2],
    ["ban1", 4, team2Id, sideForTeam(team2Id), row.Team2Ban2],
    ["ban1", 5, team1Id, sideForTeam(team1Id), row.Team1Ban3],
    ["ban1", 6, team2Id, sideForTeam(team2Id), row.Team2Ban3],
    ["ban2", 13, team2Id, sideForTeam(team2Id), row.Team2Ban4],
    ["ban2", 14, team1Id, sideForTeam(team1Id), row.Team1Ban4],
    ["ban2", 15, team2Id, sideForTeam(team2Id), row.Team2Ban5],
    ["ban2", 16, team1Id, sideForTeam(team1Id), row.Team1Ban5],
  ] as const;
  const pickOrder = [
    ["pick1", 7, team1Id, sideForTeam(team1Id), row.Team1Pick1],
    ["pick1", 8, team2Id, sideForTeam(team2Id), row.Team2Pick1],
    ["pick1", 9, team2Id, sideForTeam(team2Id), row.Team2Pick2],
    ["pick1", 10, team1Id, sideForTeam(team1Id), row.Team1Pick2],
    ["pick1", 11, team1Id, sideForTeam(team1Id), row.Team1Pick3],
    ["pick1", 12, team2Id, sideForTeam(team2Id), row.Team2Pick3],
    ["pick2", 17, team2Id, sideForTeam(team2Id), row.Team2Pick4],
    ["pick2", 18, team1Id, sideForTeam(team1Id), row.Team1Pick4],
    ["pick2", 19, team1Id, sideForTeam(team1Id), row.Team1Pick5],
    ["pick2", 20, team2Id, sideForTeam(team2Id), row.Team2Pick5],
  ] as const;

  for (const [phase, order, teamId, side, championName] of banOrder) {
    push(phase, "ban", order, teamId, side, championName);
  }
  for (const [phase, order, teamId, side, championName] of pickOrder) {
    push(phase, "pick", order, teamId, side, championName);
  }

  return rows;
}

function escapeCargoValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function cargoQuery(query: Record<string, string>, options: LeaguepediaSyncOptions = {}) {
  const params = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    limit: "500",
  });

  for (const [key, value] of Object.entries(query)) {
    params.set(key, value);
  }

  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const response = await fetchAuthenticatedLeaguepediaApi(params);

    if (response.status === 429) {
      if (maxRetries === 1) throw new LeaguepediaRateLimitError();
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }
    if (!response.ok && response.status >= 500) {
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Leaguepedia 세트 조회 실패: ${response.status}`);
    }

    const body = (await response.json()) as {
      cargoquery?: Array<{ title: Record<string, string> }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      if (maxRetries === 1) throw new LeaguepediaRateLimitError(body.error.info);
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }

    if (body.error) {
      throw new Error(`Leaguepedia 세트 조회 오류: ${body.error.info ?? body.error.code}`);
    }

    return (body.cargoquery ?? []).map((entry) => entry.title);
  }

  throw new Error("Leaguepedia 요청 제한으로 세트 정보를 가져오지 못했습니다.");
}

async function fetchScoreboardGameRows(leaguepediaMatchId: string, options?: LeaguepediaSyncOptions) {
  return cargoQuery({
    tables: "ScoreboardGames=SG",
    fields: [
      "SG.N_GameInMatch=N_GameInMatch",
      "SG.GameId=GameId",
      "SG.Team1=Team1",
      "SG.Team2=Team2",
      "SG.WinTeam=WinTeam",
      "SG.Team1Score=Team1Score",
      "SG.Team2Score=Team2Score",
      "SG.Winner=Winner",
      "SG.Gamelength=Gamelength",
      "SG.Team1Gold=Team1Gold",
      "SG.Team2Gold=Team2Gold",
      "SG.Team1Kills=Team1Kills",
      "SG.Team2Kills=Team2Kills",
      "SG.Team1Dragons=Team1Dragons",
      "SG.Team2Dragons=Team2Dragons",
      "SG.Team1Clouds=Team1Clouds",
      "SG.Team2Clouds=Team2Clouds",
      "SG.Team1Infernals=Team1Infernals",
      "SG.Team2Infernals=Team2Infernals",
      "SG.Team1Mountains=Team1Mountains",
      "SG.Team2Mountains=Team2Mountains",
      "SG.Team1Oceans=Team1Oceans",
      "SG.Team2Oceans=Team2Oceans",
      "SG.Team1Hextechs=Team1Hextechs",
      "SG.Team2Hextechs=Team2Hextechs",
      "SG.Team1Chemtechs=Team1Chemtechs",
      "SG.Team2Chemtechs=Team2Chemtechs",
      "SG.Team1Elders=Team1Elders",
      "SG.Team2Elders=Team2Elders",
      "SG.Team1RiftHeralds=Team1RiftHeralds",
      "SG.Team2RiftHeralds=Team2RiftHeralds",
      "SG.Team1VoidGrubs=Team1VoidGrubs",
      "SG.Team2VoidGrubs=Team2VoidGrubs",
      "SG.Team1Barons=Team1Barons",
      "SG.Team2Barons=Team2Barons",
      "SG.Team1Towers=Team1Towers",
      "SG.Team2Towers=Team2Towers",
      "SG.Patch=Patch",
      "SG.RiotPlatformGameId=RiotPlatformGameId",
      "SG.RiotGameId=RiotGameId",
      "SG.Team1Bans=Team1Bans",
      "SG.Team2Bans=Team2Bans",
      "SG.Team1Picks=Team1Picks",
      "SG.Team2Picks=Team2Picks",
    ].join(","),
    where: `SG.MatchId="${escapeCargoValue(leaguepediaMatchId)}"`,
    order_by: "SG.N_GameInMatch ASC",
  }, options) as Promise<CargoSetRow[]>;
}

async function fetchScheduleGameRows(leaguepediaMatchId: string, options?: LeaguepediaSyncOptions) {
  return cargoQuery({
    tables: "MatchScheduleGame=MSG",
    fields: [
      "MSG.GameId=ScheduleGameId",
      "MSG.N_GameInMatch=N_GameInMatch",
      "MSG.Blue=Blue",
      "MSG.Red=Red",
      "MSG.Winner=SideWinner",
    ].join(","),
    where: `MSG.MatchId="${escapeCargoValue(leaguepediaMatchId)}"`,
    order_by: "MSG.N_GameInMatch ASC",
  }, options) as Promise<CargoScheduleGameRow[]>;
}

async function fetchPickBanRows(leaguepediaMatchId: string, options?: LeaguepediaSyncOptions) {
  return cargoQuery({
    tables: "PicksAndBansS7=PB",
    fields: [
      "PB.GameId=GameId",
      "PB.N_GameInMatch=N_GameInMatch",
      "PB.Team1=Team1",
      "PB.Team2=Team2",
      "PB.Team1Ban1=Team1Ban1",
      "PB.Team1Ban2=Team1Ban2",
      "PB.Team1Ban3=Team1Ban3",
      "PB.Team1Ban4=Team1Ban4",
      "PB.Team1Ban5=Team1Ban5",
      "PB.Team2Ban1=Team2Ban1",
      "PB.Team2Ban2=Team2Ban2",
      "PB.Team2Ban3=Team2Ban3",
      "PB.Team2Ban4=Team2Ban4",
      "PB.Team2Ban5=Team2Ban5",
      "PB.Team1Pick1=Team1Pick1",
      "PB.Team1Pick2=Team1Pick2",
      "PB.Team1Pick3=Team1Pick3",
      "PB.Team1Pick4=Team1Pick4",
      "PB.Team1Pick5=Team1Pick5",
      "PB.Team2Pick1=Team2Pick1",
      "PB.Team2Pick2=Team2Pick2",
      "PB.Team2Pick3=Team2Pick3",
      "PB.Team2Pick4=Team2Pick4",
      "PB.Team2Pick5=Team2Pick5",
    ].join(","),
    where: `PB.MatchId="${escapeCargoValue(leaguepediaMatchId)}"`,
    order_by: "PB.N_GameInMatch ASC",
  }, options) as Promise<CargoPickBanRow[]>;
}

async function fetchPlayerRows(leaguepediaMatchId: string, options?: LeaguepediaSyncOptions) {
  return cargoQuery({
    tables: "ScoreboardPlayers=SP",
    fields: [
      "SP.GameId=GameId",
      "SP.Link=Link",
      "SP.Champion=Champion",
      "SP.Kills=Kills",
      "SP.Deaths=Deaths",
      "SP.Assists=Assists",
      "SP.Gold=Gold",
      "SP.CS=CS",
      "SP.DamageToChampions=DamageToChampions",
      "SP.VisionScore=VisionScore",
      "SP.Team=Team",
      "SP.Role=Role",
      "SP.Side=Side",
      "SP.Items=Items",
      "SP.SummonerSpells=SummonerSpells",
      "SP.Trinket=Trinket",
      "SP.RoleBoundItem=RoleBoundItem",
      "SP.KeystoneRune=KeystoneRune",
      "SP.SecondaryTree=SecondaryTree",
    ].join(","),
    where: `SP.MatchId="${escapeCargoValue(leaguepediaMatchId)}"`,
    order_by: "SP.GameId ASC, SP.Side ASC, SP.Role_Number ASC",
  }, options) as Promise<CargoPlayerRow[]>;
}

/**
 * 진행 중인 시리즈는 다음 세트가 언제 Leaguepedia에 올라올지 몰라 계속 확인해야 하는데,
 * 매번 밴픽/선수 스탯/아이템·스펠·룬 카탈로그까지 통째로 다시 가져오는 건 낭비다.
 * ScoreboardGames의 게임 수만 가볍게 세어, 이미 로컬에 있는 세트 수와 같으면(=새 게임이
 * 아직 안 올라옴) 호출부에서 무거운 전체 동기화를 건너뛸 수 있게 한다.
 */
export async function countLeaguepediaScoreboardGames(
  leaguepediaMatchId: string,
  options?: LeaguepediaSyncOptions,
): Promise<number> {
  const rows = await cargoQuery({
    tables: "ScoreboardGames=SG",
    fields: "SG.GameId=GameId",
    where: `SG.MatchId="${escapeCargoValue(leaguepediaMatchId)}"`,
  }, options);
  return rows.length;
}

/**
 * 이미 로컬 세트가 전부(밴픽 20건, 선수 스탯 10명) 채워져 있고 Leaguepedia에도 새 게임이
 * 없으면, syncLeaguepediaMatchSets 전체를 다시 돌 필요가 없다 — 관리자가 "경기 데이터
 * 동기화"를 반복해서 눌러도 이미 완성된 세트를 매번 다시 긁어오지 않도록 호출 전에
 * 먼저 이 함수로 확인한다.
 */
export async function needsLeaguepediaMatchSetsSync(
  supabase: SupabaseClient,
  matchId: string,
): Promise<boolean> {
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("leaguepedia_match_id")
    .eq("id", matchId)
    .single();
  if (matchError) throw matchError;
  const leaguepediaMatchId = (match as { leaguepedia_match_id: string | null }).leaguepedia_match_id;
  if (!leaguepediaMatchId) return true; // ID가 없으면 실제 동기화에서 그 에러가 그대로 드러나게 둔다.

  const { data: sets, error: setsError } = await supabase
    .from("sets")
    .select("id")
    .eq("match_id", matchId);
  if (setsError) throw setsError;
  const setIds = ((sets ?? []) as Array<{ id: string }>).map((row) => row.id);

  const knownGameCount = await countLeaguepediaScoreboardGames(leaguepediaMatchId);
  if (knownGameCount > setIds.length) return true; // Leaguepedia에 새 게임이 올라와 있음
  if (setIds.length === 0) return knownGameCount > 0;

  const [pickBanRes, statRes] = await Promise.all([
    supabase.from("set_picks_bans").select("set_id").in("set_id", setIds),
    supabase.from("set_player_stats").select("set_id").in("set_id", setIds),
  ]);
  if (pickBanRes.error) throw pickBanRes.error;
  if (statRes.error) throw statRes.error;

  const pickBanCountBySet = new Map<string, number>();
  for (const row of (pickBanRes.data ?? []) as Array<{ set_id: string }>) {
    pickBanCountBySet.set(row.set_id, (pickBanCountBySet.get(row.set_id) ?? 0) + 1);
  }
  const statCountBySet = new Map<string, number>();
  for (const row of (statRes.data ?? []) as Array<{ set_id: string }>) {
    statCountBySet.set(row.set_id, (statCountBySet.get(row.set_id) ?? 0) + 1);
  }

  // 세트당 밴 10 + 픽 10 = 20건, 선수 스탯 10명이 다 있어야 완성으로 본다(어드민 화면의
  // "픽 X/10 · 밴 X/10 · 스탯 X/10" 완성도 기준과 동일).
  return setIds.some(
    (id) => (pickBanCountBySet.get(id) ?? 0) < 20 || (statCountBySet.get(id) ?? 0) < 10,
  );
}

async function fetchLeaguepediaSetRows(
  leaguepediaMatchId: string,
  options?: LeaguepediaSyncOptions,
): Promise<MergedCargoSetRow[]> {
  const [scoreboardRows, scheduleRows] = await Promise.all([
    fetchScoreboardGameRows(leaguepediaMatchId, options),
    fetchScheduleGameRows(leaguepediaMatchId, options),
  ]);
  const scheduleBySetNumber = new Map(
    scheduleRows.map((row) => [parseInteger(row.N_GameInMatch), row]),
  );

  const coveredSetNumbers = new Set<number>();
  const merged = scoreboardRows.map((row, index) => {
    const setNumber = parseInteger(row.N_GameInMatch) ?? index + 1;
    coveredSetNumbers.add(setNumber);
    return {
      ...row,
      ...(scheduleBySetNumber.get(parseInteger(row.N_GameInMatch)) ??
        scheduleBySetNumber.get(index + 1)),
    };
  });

  // 상세 스코어보드가 아직 위키에 안 올라온 게임도, 대진표(MatchScheduleGame)에
  // 승자가 이미 나와 있으면(SideWinner) 세트만이라도 먼저 만든다 — 편집 지연으로
  // 세트가 통째로 누락되는 것보다 낫다. 아직 진영만 정해지고 결과가 없는(=진행
  // 예정) 게임은 winner_team_id를 만들 수 없어 status='finished' 제약에 걸리므로
  // 제외한다. 나머지 스탯 필드는 비어 있으므로 상세 스코어보드가 올라오면 다음
  // 동기화에서 자연히 채워진다.
  const scheduleOnlyRows = scheduleRows.filter((row) => {
    const setNumber = parseInteger(row.N_GameInMatch);
    if (setNumber == null || coveredSetNumbers.has(setNumber)) return false;
    const sideWinner = parseInteger(row.SideWinner);
    return sideWinner === 1 || sideWinner === 2;
  });

  return [...merged, ...scheduleOnlyRows].sort(
    (a, b) => (parseInteger(a.N_GameInMatch) ?? 0) - (parseInteger(b.N_GameInMatch) ?? 0),
  );
}

export async function syncLeaguepediaMatchSets(
  supabase: SupabaseClient,
  matchId: string,
  options: LeaguepediaSyncOptions = {},
): Promise<LeaguepediaMatchSetsSyncSummary> {
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, leaguepedia_match_id, best_of, team_a_id, team_b_id, tournament:tournament_id(league), team_a:team_a_id(id, slug, name, short_name, leaguepedia_page, source_team_id, is_lck_team), team_b:team_b_id(id, slug, name, short_name, leaguepedia_page, source_team_id, is_lck_team)",
    )
    .eq("id", matchId)
    .single();

  if (matchError) {
    throw matchError;
  }

  const typedMatch = match as unknown as MatchRow;

  const teamIds = [typedMatch.team_a_id, typedMatch.team_b_id].filter(
    (id): id is string => Boolean(id),
  );
  const { data: teamAliasRows, error: teamAliasError } = await supabase
    .from("leaguepedia_team_aliases")
    .select("team_id, page_name")
    .in("team_id", teamIds);
  if (teamAliasError) throw teamAliasError;
  typedMatch.team_aliases = (teamAliasRows ?? []).map((alias) => ({
    entity_id: alias.team_id,
    page_name: alias.page_name,
  }));

  if (!typedMatch.leaguepedia_match_id) {
    throw new Error("Leaguepedia Match ID가 없는 경기입니다.");
  }

  const rows = await fetchLeaguepediaSetRows(typedMatch.leaguepedia_match_id, options);

  if (rows.length === 0) {
    throw new Error("Leaguepedia에서 세트 정보를 찾지 못했습니다.");
  }

  const observedTeamAliases = new Map<string, string>();
  for (const row of rows) {
    for (const pageName of [row.Team1, row.Team2, row.WinTeam, row.Blue, row.Red]) {
      const resolvedTeamId = resolveTeamId(pageName, typedMatch);
      if (resolvedTeamId && pageName?.trim()) {
        observedTeamAliases.set(pageName.trim(), resolvedTeamId);
      }
    }
  }
  if (observedTeamAliases.size > 0) {
    const { error: aliasUpsertError } = await supabase
      .from("leaguepedia_team_aliases")
      .upsert(
        [...observedTeamAliases].map(([page_name, team_id]) => ({ team_id, page_name })),
        { onConflict: "page_name", ignoreDuplicates: true },
      );
    if (aliasUpsertError) throw aliasUpsertError;
  }

  const payload = rows.map((row, index) => {
    const setNumber = parseInteger(row.N_GameInMatch) ?? index + 1;
    const blueTeamId = resolveTeamId(row.Blue, typedMatch);
    const redTeamId = resolveTeamId(row.Red, typedMatch);

    return {
      match_id: typedMatch.id,
      set_number: setNumber,
      // 스코어보드(경기 통계) 또는 최소 대진표 승자 정보가 있는 세트이므로 최소
      // '경기종료'. 선수 상세 스탯까지 동기화되면 아래 최종 패스에서
      // 'data_synced'로 격상한다.
      status: "finished" as const,
      winner_team_id: winnerTeamId(row, typedMatch),
      blue_team_id: blueTeamId,
      red_team_id: redTeamId,
      duration_seconds: parseDurationSeconds(row.Gamelength),
      blue_kills: parseInteger(
        statForSide({
          sideTeamId: blueTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1Kills,
          team2Value: row.Team2Kills,
        }),
      ),
      red_kills: parseInteger(
        statForSide({
          sideTeamId: redTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1Kills,
          team2Value: row.Team2Kills,
        }),
      ),
      blue_gold: goldForSide({
          sideTeamId: blueTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1Gold,
          team2Value: row.Team2Gold,
      }),
      red_gold: goldForSide({
          sideTeamId: redTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1Gold,
          team2Value: row.Team2Gold,
      }),
      blue_dragons: parseInteger(
        statForSide({
          sideTeamId: blueTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1Dragons,
          team2Value: row.Team2Dragons,
        }),
      ),
      red_dragons: parseInteger(
        statForSide({
          sideTeamId: redTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1Dragons,
          team2Value: row.Team2Dragons,
        }),
      ),
      blue_clouds: parsedStatForSide({
        sideTeamId: blueTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Clouds,
        team2Value: row.Team2Clouds,
      }),
      red_clouds: parsedStatForSide({
        sideTeamId: redTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Clouds,
        team2Value: row.Team2Clouds,
      }),
      blue_infernals: parsedStatForSide({
        sideTeamId: blueTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Infernals,
        team2Value: row.Team2Infernals,
      }),
      red_infernals: parsedStatForSide({
        sideTeamId: redTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Infernals,
        team2Value: row.Team2Infernals,
      }),
      blue_mountains: parsedStatForSide({
        sideTeamId: blueTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Mountains,
        team2Value: row.Team2Mountains,
      }),
      red_mountains: parsedStatForSide({
        sideTeamId: redTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Mountains,
        team2Value: row.Team2Mountains,
      }),
      blue_oceans: parsedStatForSide({
        sideTeamId: blueTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Oceans,
        team2Value: row.Team2Oceans,
      }),
      red_oceans: parsedStatForSide({
        sideTeamId: redTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Oceans,
        team2Value: row.Team2Oceans,
      }),
      blue_hextechs: parsedStatForSide({
        sideTeamId: blueTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Hextechs,
        team2Value: row.Team2Hextechs,
      }),
      red_hextechs: parsedStatForSide({
        sideTeamId: redTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Hextechs,
        team2Value: row.Team2Hextechs,
      }),
      blue_chemtechs: parsedStatForSide({
        sideTeamId: blueTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Chemtechs,
        team2Value: row.Team2Chemtechs,
      }),
      red_chemtechs: parsedStatForSide({
        sideTeamId: redTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Chemtechs,
        team2Value: row.Team2Chemtechs,
      }),
      blue_elders: parsedStatForSide({
        sideTeamId: blueTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Elders,
        team2Value: row.Team2Elders,
      }),
      red_elders: parsedStatForSide({
        sideTeamId: redTeamId,
        row,
        match: typedMatch,
        team1Value: row.Team1Elders,
        team2Value: row.Team2Elders,
      }),
      blue_rift_heralds: parseInteger(
        statForSide({
          sideTeamId: blueTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1RiftHeralds,
          team2Value: row.Team2RiftHeralds,
        }),
      ),
      red_rift_heralds: parseInteger(
        statForSide({
          sideTeamId: redTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1RiftHeralds,
          team2Value: row.Team2RiftHeralds,
        }),
      ),
      blue_void_grubs: parseInteger(
        statForSide({
          sideTeamId: blueTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1VoidGrubs,
          team2Value: row.Team2VoidGrubs,
        }),
      ),
      red_void_grubs: parseInteger(
        statForSide({
          sideTeamId: redTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1VoidGrubs,
          team2Value: row.Team2VoidGrubs,
        }),
      ),
      blue_barons: parseInteger(
        statForSide({
          sideTeamId: blueTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1Barons,
          team2Value: row.Team2Barons,
        }),
      ),
      red_barons: parseInteger(
        statForSide({
          sideTeamId: redTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1Barons,
          team2Value: row.Team2Barons,
        }),
      ),
      blue_towers: parseInteger(
        statForSide({
          sideTeamId: blueTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1Towers,
          team2Value: row.Team2Towers,
        }),
      ),
      red_towers: parseInteger(
        statForSide({
          sideTeamId: redTeamId,
          row,
          match: typedMatch,
          team1Value: row.Team1Towers,
          team2Value: row.Team2Towers,
        }),
      ),
      patch: row.Patch || null,
      leaguepedia_game_id: row.ScheduleGameId || null,
      riot_match_id: row.RiotGameId || null,
      riot_platform_game_id: row.RiotPlatformGameId || null,
    };
  }, options);

  const { data, error } = await supabase
    .from("sets")
    .upsert(payload, { onConflict: "match_id,set_number" })
    .select("id,set_number,leaguepedia_game_id,duration_seconds,blue_team_id,red_team_id,patch");

  if (error) {
    throw error;
  }

  const setRows = (data ?? []) as Array<{
    id: string;
    set_number: number;
    leaguepedia_game_id: string | null;
    duration_seconds: number | null;
    blue_team_id: string | null;
    red_team_id: string | null;
    patch: string | null;
  }>;
  const setIds = setRows.map((set) => set.id);
  const setByNumber = new Map(setRows.map((set) => [set.set_number, set]));
  const setByGameId = new Map(
    setRows.filter((set) => set.leaguepedia_game_id).map((set) => [set.leaguepedia_game_id!, set]),
  );
  let picksBansUpserted = 0;
  let playerStatsUpserted = 0;
  let itemsResolved = 0;
  let spellsResolved = 0;
  let runesResolved = 0;

  if (setIds.length > 0) {
    const [picksAndBansRows, playerRows] = await Promise.all([
      fetchPickBanRows(typedMatch.leaguepedia_match_id, options),
      fetchPlayerRows(typedMatch.leaguepedia_match_id, options),
    ]);
    const pickBanRows = resolveLeaguepediaPickBanRows(rows, picksAndBansRows);
    const championNames = [
      ...pickBanRows.flatMap((row) => [
        row.Team1Ban1,
        row.Team1Ban2,
        row.Team1Ban3,
        row.Team1Ban4,
        row.Team1Ban5,
        row.Team2Ban1,
        row.Team2Ban2,
        row.Team2Ban3,
        row.Team2Ban4,
        row.Team2Ban5,
        row.Team1Pick1,
        row.Team1Pick2,
        row.Team1Pick3,
        row.Team1Pick4,
        row.Team1Pick5,
        row.Team2Pick1,
        row.Team2Pick2,
        row.Team2Pick3,
        row.Team2Pick4,
        row.Team2Pick5,
      ]),
      ...playerRows.map((row) => row.Champion),
    ].filter(Boolean) as string[];
    const ddragonVersions = uniqueDdragonVersionsForPatches(setRows.map((set) => set.patch));
    const [championMap, playerMap, versionedCatalogs] = await Promise.all([
      getChampionMap(supabase, championNames),
      getPlayerMap(supabase),
      Promise.all(
        ddragonVersions.map(async (version) => {
          const [itemNameToId, spellCatalog, runeNameToId] = await Promise.all([
            buildItemNameToIdMap(version),
            fetchSpellCatalog(version, "en_US").catch(() => [] as GameSpell[]),
            fetchRuneNameToIdMap(version).catch(() => new Map<string, number>()),
          ]);
          return [
            version,
            {
              itemNameToId,
              spellKeyToId: buildSpellKeyToIdMap(spellCatalog),
              runeNameToId,
            },
          ] as const;
        }),
      ),
    ]);
    const catalogsByVersion = new Map(versionedCatalogs);
    await ensurePlayersForStats({
      supabase,
      playerMap,
      playerRows,
      match: typedMatch,
      setByGameId,
    });

    const { data: existingStats, error: existingStatsError } = await supabase
      .from("set_player_stats")
      .select("set_id, player_id, item0, item1, item2, item3, item4, item5, item6, spell0, spell1, rune0, rune1, role_bound_item")
      .in("set_id", setIds);
    if (existingStatsError) {
      throw existingStatsError;
    }
    const typedExistingStats = (existingStats ?? []) as Array<
      { set_id: string; player_id: string } & PreservedPlayerBuild
    >;
    const itemBySetPlayer = new Map(
      typedExistingStats.map((stat) => [
        playerItemsKey(stat.set_id, stat.player_id),
        {
          item0: stat.item0,
          item1: stat.item1,
          item2: stat.item2,
          item3: stat.item3,
          item4: stat.item4,
          item5: stat.item5,
          item6: stat.item6,
          spell0: stat.spell0,
          spell1: stat.spell1,
          rune0: stat.rune0,
          rune1: stat.rune1,
          role_bound_item: stat.role_bound_item,
        },
      ]),
    );
    const existingPlayerIdsBySet = new Map<string, string[]>();
    for (const stat of typedExistingStats) {
      const list = existingPlayerIdsBySet.get(stat.set_id);
      if (list) {
        list.push(stat.player_id);
      } else {
        existingPlayerIdsBySet.set(stat.set_id, [stat.player_id]);
      }
    }

    const pickBanPayload = pickBanRows.flatMap((row) => {
      const setNumber = parseInteger(row.N_GameInMatch);
      const set = setNumber ? setByNumber.get(setNumber) : setByGameId.get(row.GameId ?? "");
      if (!set) {
        return [];
      }
      return pickBanRowsForSet({
        setId: set.id,
        row,
        match: typedMatch,
        blueTeamId: set.blue_team_id,
        redTeamId: set.red_team_id,
        championMap,
      });
    });

    if (pickBanPayload.length > 0) {
      // 삭제 후 삽입 순서를 뒤집는다: 새 데이터가 이미 준비된 세트의 기존 행 id만
      // 미리 확보해두고, 삽입이 성공한 뒤에만 지운다. 삽입 도중 실패해도 기존
      // 밴픽 데이터가 사라지지 않는다. 응답에 없던 세트의 기존 데이터는 그대로 둔다.
      const touchedSetIds = Array.from(new Set(pickBanPayload.map((entry) => entry.set_id)));
      const { data: oldPickBans, error: oldPickBanError } = await supabase
        .from("set_picks_bans")
        .select("id")
        .in("set_id", touchedSetIds);
      if (oldPickBanError) {
        throw oldPickBanError;
      }

      const { data: insertedPickBans, error: pickBanError } = await supabase
        .from("set_picks_bans")
        .insert(pickBanPayload)
        .select("id");
      if (pickBanError) {
        throw pickBanError;
      }
      picksBansUpserted = insertedPickBans?.length ?? 0;

      const oldPickBanIds = (oldPickBans ?? []).map((row) => row.id as string);
      if (oldPickBanIds.length > 0) {
        const { error: deleteOldPickBanError } = await supabase
          .from("set_picks_bans")
          .delete()
          .in("id", oldPickBanIds);
        if (deleteOldPickBanError) {
          throw deleteOldPickBanError;
        }
      }
    }

    const statPayload = playerRows.flatMap((row) => {
      const set = setByGameId.get(row.GameId ?? "");
      const player = playerForLeaguepediaLink(playerMap, row.Link);
      const position = roleToPosition(row.Role);
      if (!set || !player || !position) {
        return [];
      }
      const side = sideLabel(row.Side);
      const teamId =
        resolveTeamId(row.Team, typedMatch) ??
        (side === "blue" ? set.blue_team_id : side === "red" ? set.red_team_id : null) ??
        player.team_id;
      if (!teamId) {
        return [];
      }
      const resolvedSide = side ?? (teamId === set.blue_team_id ? "blue" : "red");
      const preservedBuild = itemBySetPlayer.get(playerItemsKey(set.id, player.id));
      const catalog = catalogsByVersion.get(ddragonVersionFromPatch(set.patch));
      const itemNameToId = catalog?.itemNameToId ?? new Map<string, number>();
      const spellKeyToId = catalog?.spellKeyToId ?? new Map<string, number>();
      const runeNameToId = catalog?.runeNameToId ?? new Map<string, number>();

      const parsedItems = parseLeaguepediaItems(row.Items, itemNameToId);
      const trinketName = String(row.Trinket ?? "").trim().toLowerCase();
      parsedItems[6] = trinketName ? (itemNameToId.get(trinketName) ?? null) : null;
      const roleBoundName = String(row.RoleBoundItem ?? "").trim().toLowerCase();
      const parsedRoleBoundItem = roleBoundName ? (itemNameToId.get(roleBoundName) ?? null) : null;

      const parsedSpells = parseLeaguepediaSpells(row.SummonerSpells, spellKeyToId);

      const keystoneName = String(row.KeystoneRune ?? "").trim().toLowerCase();
      const secondaryName = String(row.SecondaryTree ?? "").trim().toLowerCase();
      const parsedRune0 = keystoneName ? (runeNameToId.get(keystoneName) ?? null) : null;
      const parsedRune1 = secondaryName ? (runeNameToId.get(secondaryName) ?? null) : null;

      const hasItems = parsedItems.some((id) => id !== null);
      const hasSpells = parsedSpells.some((id) => id !== null);
      if (hasItems) itemsResolved += parsedItems.filter((id) => id !== null).length;
      if (hasSpells) spellsResolved += parsedSpells.filter((id) => id !== null).length;
      if (parsedRune0 !== null) runesResolved++;
      if (parsedRune1 !== null) runesResolved++;

      return [
        {
          set_id: set.id,
          player_id: player.id,
          team_id: teamId,
          side: resolvedSide,
          position,
          champion_id: championIdFor(championMap, row.Champion),
          kills: parseInteger(row.Kills) ?? 0,
          deaths: parseInteger(row.Deaths) ?? 0,
          assists: parseInteger(row.Assists) ?? 0,
          cs: parseInteger(row.CS) ?? 0,
          gold: parseGold(row.Gold) ?? 0,
          damage_to_champions: parseInteger(row.DamageToChampions) ?? 0,
          vision_score: parseInteger(row.VisionScore) ?? 0,
          item0: hasItems ? parsedItems[0] : (preservedBuild?.item0 ?? null),
          item1: hasItems ? parsedItems[1] : (preservedBuild?.item1 ?? null),
          item2: hasItems ? parsedItems[2] : (preservedBuild?.item2 ?? null),
          item3: hasItems ? parsedItems[3] : (preservedBuild?.item3 ?? null),
          item4: hasItems ? parsedItems[4] : (preservedBuild?.item4 ?? null),
          item5: hasItems ? parsedItems[5] : (preservedBuild?.item5 ?? null),
          item6: hasItems ? parsedItems[6] : (preservedBuild?.item6 ?? null),
          spell0: hasSpells ? parsedSpells[0] : (preservedBuild?.spell0 ?? null),
          spell1: hasSpells ? parsedSpells[1] : (preservedBuild?.spell1 ?? null),
          rune0: parsedRune0 ?? (preservedBuild?.rune0 ?? null),
          rune1: parsedRune1 ?? (preservedBuild?.rune1 ?? null),
          role_bound_item: parsedRoleBoundItem ?? (preservedBuild?.role_bound_item ?? null),
        },
      ];
    });

    if (statPayload.length > 0) {
      // delete-then-insert 대신 (set_id, player_id) upsert를 사용해 삽입 실패 시에도
      // 기존 스탯이 사라지지 않게 한다. 새 데이터에서 빠진 선수만 별도로 정리한다.
      const { data: upsertedStats, error: statsError } = await supabase
        .from("set_player_stats")
        .upsert(statPayload, { onConflict: "set_id,player_id" })
        .select("id");
      if (statsError) {
        throw statsError;
      }
      playerStatsUpserted = upsertedStats?.length ?? 0;

      const keepPlayerIdsBySet = new Map<string, Set<string>>();
      for (const entry of statPayload) {
        const set = keepPlayerIdsBySet.get(entry.set_id);
        if (set) {
          set.add(entry.player_id);
        } else {
          keepPlayerIdsBySet.set(entry.set_id, new Set([entry.player_id]));
        }
      }

      for (const [setId, keepPlayerIds] of keepPlayerIdsBySet) {
        const stalePlayerIds = (existingPlayerIdsBySet.get(setId) ?? []).filter(
          (playerId) => !keepPlayerIds.has(playerId),
        );
        if (stalePlayerIds.length > 0) {
          const { error: cleanupStatsError } = await supabase
            .from("set_player_stats")
            .delete()
            .eq("set_id", setId)
            .in("player_id", stalePlayerIds);
          if (cleanupStatsError) {
            throw cleanupStatsError;
          }
        }
      }
    }

    // 세트별 실제 데이터 보유 현황(경기통계/밴픽/선수상세)으로 상태를 도출해 반영한다.
    const gameStatsBySetNumber = new Map(
      payload.map((entry) => [
        entry.set_number,
        entry.winner_team_id != null ||
          entry.duration_seconds != null ||
          entry.blue_kills != null ||
          entry.red_kills != null,
      ]),
    );
    const pickCountBySet = new Map<string, number>();
    const banCountBySet = new Map<string, number>();
    for (const entry of pickBanPayload) {
      const counter = entry.action_type === "pick" ? pickCountBySet : banCountBySet;
      counter.set(entry.set_id, (counter.get(entry.set_id) ?? 0) + 1);
    }
    const playerStatEntriesBySet = new Map<
      string,
      Array<{ playerId: string; teamId: string; position: string }>
    >();
    for (const entry of statPayload) {
      const list = playerStatEntriesBySet.get(entry.set_id);
      const record = { playerId: entry.player_id, teamId: entry.team_id, position: entry.position };
      if (list) {
        list.push(record);
      } else {
        playerStatEntriesBySet.set(entry.set_id, [record]);
      }
    }

    const setIdsByStatus = new Map<string, string[]>();
    for (const set of setRows) {
      const status = deriveSetStatus({
        hasGameStats: gameStatsBySetNumber.get(set.set_number) ?? false,
        hasPlayerStats: hasCompletePlayerStats(
          playerStatEntriesBySet.get(set.id) ?? [],
          set.blue_team_id,
          set.red_team_id,
        ),
        pickCount: pickCountBySet.get(set.id) ?? 0,
        banCount: banCountBySet.get(set.id) ?? 0,
      });
      const ids = setIdsByStatus.get(status);
      if (ids) {
        ids.push(set.id);
      } else {
        setIdsByStatus.set(status, [set.id]);
      }
    }

    for (const [status, ids] of setIdsByStatus) {
      const { error: statusError } = await supabase
        .from("sets")
        .update({ status })
        .in("id", ids);
      if (statusError) {
        throw statusError;
      }
    }
  }

  // 세트 상태가 모두 확정된 뒤, 확정된 세트 결과로부터 매치 스코어/상태/승자를 재조정한다.
  await reconcileMatchFromSets(supabase, typedMatch.id);
  if (options.refreshAiPreview !== false) {
    // match-preview-ai.ts uses Next.js-only "@/" aliases and server APIs, so it's only
    // resolvable inside the Next.js app. Loading it lazily lets headless Node scripts
    // (which always pass refreshAiPreview: false) skip it entirely instead of crashing
    // at module-load time on a static import.
    const { refreshMatchAiPreviewCacheForMatchId } = await import("../match-preview-ai.ts");
    await refreshMatchAiPreviewCacheForMatchId(typedMatch.id);
  }

  return {
    matchId: typedMatch.id,
    leaguepediaMatchId: typedMatch.leaguepedia_match_id,
    fetched: rows.length,
    upserted: data?.length ?? 0,
    picksBansUpserted,
    playerStatsUpserted,
    itemsResolved,
    spellsResolved,
    runesResolved,
  };
}
