import type { SupabaseClient } from "@supabase/supabase-js";

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 8;

type MatchTeamRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  leaguepedia_page: string | null;
  is_lck_team?: boolean | null;
};

type MatchRow = {
  id: string;
  leaguepedia_match_id: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a: MatchTeamRow | null;
  team_b: MatchTeamRow | null;
};

type CargoSetRow = {
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
};

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

function teamNameKeys(team: MatchTeamRow | null | undefined) {
  if (!team) {
    return [];
  }

  return [team.id, team.slug, team.name, team.short_name, team.leaguepedia_page]
    .filter(Boolean)
    .map((value) => normalizeName(String(value)));
}

function resolveTeamId(
  value: string | null | undefined,
  match: MatchRow,
) {
  const normalized = normalizeName(value);
  const aliasedSlug = TEAM_ALIASES.get(normalized);
  const teamAKeys = teamNameKeys(match.team_a);
  const teamBKeys = teamNameKeys(match.team_b);

  if (teamAKeys.includes(normalized) || (aliasedSlug && teamAKeys.includes(aliasedSlug))) {
    return match.team_a_id;
  }
  if (teamBKeys.includes(normalized) || (aliasedSlug && teamBKeys.includes(aliasedSlug))) {
    return match.team_b_id;
  }

  return null;
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

  const byName = new Map(
    (existing as ExistingChampion[]).map((champion) => [
      normalizeName(champion.ddragon_id || champion.name || champion.slug),
      champion.id,
    ]),
  );

  const missing = normalizedNames.filter((name) => !byName.has(normalizeName(name)));

  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("champions")
      .upsert(
        missing.map((name) => ({
          slug: slugify(name),
          name,
          ddragon_id: name.replace(/\s+/g, ""),
        })),
        { onConflict: "slug" },
      )
      .select("id, slug, name, ddragon_id");

    if (insertError) {
      throw insertError;
    }

    for (const champion of inserted as ExistingChampion[]) {
      byName.set(normalizeName(champion.ddragon_id || champion.name || champion.slug), champion.id);
      byName.set(normalizeName(champion.name), champion.id);
    }
  }

  return byName;
}

async function getPlayerMap(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("players")
    .select("id, slug, name, team_id, position, leaguepedia_page");

  if (error) {
    throw error;
  }

  const byName = new Map<string, ExistingPlayer>();
  for (const player of data as ExistingPlayer[]) {
    byName.set(normalizeName(player.name), player);
    byName.set(normalizeName(player.slug), player);
    if (player.leaguepedia_page) {
      byName.set(normalizeName(player.leaguepedia_page), player);
      byName.set(normalizeName(displayNameFromLeaguepediaPage(player.leaguepedia_page)), player);
    }
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
    is_lck_player: boolean;
    imported_scope: "lck" | "international_event";
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
      is_lck_player: isLckTeamId(teamId, match),
      imported_scope: isLckTeamId(teamId, match) ? "lck" : "international_event",
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
}

function championIdFor(map: Map<string, string>, name: string | null | undefined) {
  const normalized = normalizeChampionName(name);
  return map.get(normalizeName(normalized)) ?? map.get(normalizeName(normalized.replace(/\s+/g, ""))) ?? null;
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

async function cargoQuery(query: Record<string, string>) {
  const params = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    limit: "500",
  });

  for (const [key, value] of Object.entries(query)) {
    params.set(key, value);
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const response = await fetch(`${CARGO_API}?${params.toString()}`, {
      headers: {
        "user-agent": "LCKHubMinion/0.1 (Leaguepedia set sync; contact: local-dev)",
      },
    });

    if (!response.ok && (response.status === 429 || response.status >= 500)) {
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

async function fetchScoreboardGameRows(leaguepediaMatchId: string) {
  return cargoQuery({
    tables: "ScoreboardGames=SG",
    fields: [
      "SG.N_GameInMatch=N_GameInMatch",
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
    ].join(","),
    where: `SG.MatchId="${escapeCargoValue(leaguepediaMatchId)}"`,
    order_by: "SG.N_GameInMatch ASC",
  }) as Promise<CargoSetRow[]>;
}

async function fetchScheduleGameRows(leaguepediaMatchId: string) {
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
  }) as Promise<CargoScheduleGameRow[]>;
}

async function fetchPickBanRows(leaguepediaMatchId: string) {
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
  }) as Promise<CargoPickBanRow[]>;
}

async function fetchPlayerRows(leaguepediaMatchId: string) {
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
    ].join(","),
    where: `SP.MatchId="${escapeCargoValue(leaguepediaMatchId)}"`,
    order_by: "SP.GameId ASC, SP.Side ASC, SP.Role_Number ASC",
  }) as Promise<CargoPlayerRow[]>;
}

async function fetchLeaguepediaSetRows(leaguepediaMatchId: string): Promise<MergedCargoSetRow[]> {
  const [scoreboardRows, scheduleRows] = await Promise.all([
    fetchScoreboardGameRows(leaguepediaMatchId),
    fetchScheduleGameRows(leaguepediaMatchId),
  ]);
  const scheduleBySetNumber = new Map(
    scheduleRows.map((row) => [parseInteger(row.N_GameInMatch), row]),
  );

  return scoreboardRows.map((row, index) => ({
    ...row,
    ...(scheduleBySetNumber.get(parseInteger(row.N_GameInMatch)) ??
      scheduleBySetNumber.get(index + 1)),
  }));
}

export async function syncLeaguepediaMatchSets(
  supabase: SupabaseClient,
  matchId: string,
): Promise<LeaguepediaMatchSetsSyncSummary> {
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, leaguepedia_match_id, team_a_id, team_b_id, team_a:team_a_id(id, slug, name, short_name, leaguepedia_page, is_lck_team), team_b:team_b_id(id, slug, name, short_name, leaguepedia_page, is_lck_team)",
    )
    .eq("id", matchId)
    .single();

  if (matchError) {
    throw matchError;
  }

  const typedMatch = match as unknown as MatchRow;

  if (!typedMatch.leaguepedia_match_id) {
    throw new Error("Leaguepedia Match ID가 없는 경기입니다.");
  }

  const rows = await fetchLeaguepediaSetRows(typedMatch.leaguepedia_match_id);

  if (rows.length === 0) {
    throw new Error("Leaguepedia에서 세트 정보를 찾지 못했습니다.");
  }

  const payload = rows.map((row, index) => {
    const setNumber = parseInteger(row.N_GameInMatch) ?? index + 1;
    const blueTeamId = resolveTeamId(row.Blue, typedMatch);
    const redTeamId = resolveTeamId(row.Red, typedMatch);

    return {
      match_id: typedMatch.id,
      set_number: setNumber,
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
  });

  const { data, error } = await supabase
    .from("sets")
    .upsert(payload, { onConflict: "match_id,set_number" })
    .select("id,set_number,leaguepedia_game_id,duration_seconds,blue_team_id,red_team_id");

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
  }>;
  const setIds = setRows.map((set) => set.id);
  const setByNumber = new Map(setRows.map((set) => [set.set_number, set]));
  const setByGameId = new Map(
    setRows.filter((set) => set.leaguepedia_game_id).map((set) => [set.leaguepedia_game_id!, set]),
  );
  let picksBansUpserted = 0;
  let playerStatsUpserted = 0;

  if (setIds.length > 0) {
    const [pickBanRows, playerRows] = await Promise.all([
      fetchPickBanRows(typedMatch.leaguepedia_match_id),
      fetchPlayerRows(typedMatch.leaguepedia_match_id),
    ]);
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
    const [championMap, playerMap] = await Promise.all([
      getChampionMap(supabase, championNames),
      getPlayerMap(supabase),
    ]);
    await ensurePlayersForStats({
      supabase,
      playerMap,
      playerRows,
      match: typedMatch,
      setByGameId,
    });

    const { error: deletePickBanError } = await supabase
      .from("set_picks_bans")
      .delete()
      .in("set_id", setIds);
    if (deletePickBanError) {
      throw deletePickBanError;
    }
    const { data: existingStats, error: existingStatsError } = await supabase
      .from("set_player_stats")
      .select("set_id, player_id, item0, item1, item2, item3, item4, item5, item6, spell0, spell1, rune0, rune1")
      .in("set_id", setIds);
    if (existingStatsError) {
      throw existingStatsError;
    }
    const itemBySetPlayer = new Map(
      ((existingStats ?? []) as Array<{ set_id: string; player_id: string } & PreservedPlayerBuild>).map((stat) => [
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
        },
      ]),
    );
    const { error: deleteStatsError } = await supabase
      .from("set_player_stats")
      .delete()
      .in("set_id", setIds);
    if (deleteStatsError) {
      throw deleteStatsError;
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
      const { data: insertedPickBans, error: pickBanError } = await supabase
        .from("set_picks_bans")
        .insert(pickBanPayload)
        .select("id");
      if (pickBanError) {
        throw pickBanError;
      }
      picksBansUpserted = insertedPickBans?.length ?? 0;
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
          ...(preservedBuild ?? {}),
        },
      ];
    });

    if (statPayload.length > 0) {
      const { data: insertedStats, error: statsError } = await supabase
        .from("set_player_stats")
        .insert(statPayload)
        .select("id");
      if (statsError) {
        throw statsError;
      }
      playerStatsUpserted = insertedStats?.length ?? 0;
    }
  }

  return {
    matchId: typedMatch.id,
    leaguepediaMatchId: typedMatch.leaguepedia_match_id,
    fetched: rows.length,
    upserted: data?.length ?? 0,
    picksBansUpserted,
    playerStatsUpserted,
  };
}
