import { createReadStream, readFileSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { championCatalogEntryForValue } from "../lib/champions";

type SetRow = {
  id: string;
  riot_platform_game_id: string | null;
  blue_team_id: string | null;
  red_team_id: string | null;
};

type ExistingPlayer = {
  id: string;
  slug: string;
  name: string;
  team_id: string | null;
  position: string;
  leaguepedia_page?: string | null;
};

type ExistingChampion = {
  id: string;
  slug: string;
  name: string;
  ddragon_id?: string | null;
};

type TeamRow = {
  id: string;
  is_lck_team: boolean | null;
};

type ExistingBuild = {
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

type CsvRow = {
  setId: string;
  riotPlatformGameId: string;
  side: "blue" | "red";
  position: string;
  playerName: string;
  teamName: string;
  teamId: string;
  champion: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  cs: number | null;
  gold: number | null;
  damageToChampions: number | null;
  visionScore: number | null;
  wardsPlaced: number | null;
  wardsKilled: number | null;
  dpm: number | null;
  damageShare: number | null;
  visionScorePerMinute: number | null;
  csPerMinute: number | null;
  goldDiffAt10: number | null;
  xpDiffAt10: number | null;
  csDiffAt10: number | null;
  goldDiffAt15: number | null;
  xpDiffAt15: number | null;
  csDiffAt15: number | null;
};

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");

  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) {
        process.env[key] = valueParts.join("=");
      }
    }
  } catch {
    // Optional when environment variables are already provided.
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slugify(value: string) {
  return normalizeName(value)
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeHeader(value: string) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseInteger(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function toNumber(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
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
  if (normalized === "blue") return "blue";
  if (normalized === "red") return "red";
  return null;
}

async function readCsvRows(
  filePath: string,
  setByGameId: Map<string, SetRow>,
) {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let headerIndex = new Map<string, number>();
  const rows: CsvRow[] = [];
  let totalLines = 0;
  let matchedLines = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    totalLines += 1;
    const cells = parseCsvLine(line);

    if (headerIndex.size === 0) {
      headerIndex = new Map(
        cells.map((cell, index) => [normalizeHeader(cell), index]),
      );
      continue;
    }

    const get = (name: string) => cells[headerIndex.get(normalizeHeader(name)) ?? -1] ?? "";
    const riotPlatformGameId = get("gameid").trim();
    const set = setByGameId.get(riotPlatformGameId);
    if (!riotPlatformGameId || !set) {
      continue;
    }

    const position = roleToPosition(get("position"));
    const side = sideLabel(get("side"));
    if (!position || !side) {
      continue;
    }

    rows.push({
      setId: set.id,
      riotPlatformGameId,
      side,
      position,
      playerName: get("playername").trim(),
      teamName: get("teamname").trim(),
      teamId: get("teamid").trim(),
      champion: get("champion").trim(),
      kills: parseInteger(get("kills")),
      deaths: parseInteger(get("deaths")),
      assists: parseInteger(get("assists")),
      cs: parseInteger(get("total cs")),
      gold: toNumber(get("totalgold")),
      damageToChampions: toNumber(get("damagetochampions")),
      visionScore: parseInteger(get("visionscore")),
      wardsPlaced: parseInteger(get("wardsplaced")),
      wardsKilled: parseInteger(get("wardskilled")),
      dpm: toNumber(get("dpm")),
      damageShare: toNumber(get("damageshare")),
      visionScorePerMinute: toNumber(get("vspm")),
      csPerMinute: toNumber(get("cspm")),
      goldDiffAt10: toNumber(get("golddiffat10")),
      xpDiffAt10: toNumber(get("xpdiffat10")),
      csDiffAt10: toNumber(get("csdiffat10")),
      goldDiffAt15: toNumber(get("golddiffat15")),
      xpDiffAt15: toNumber(get("xpdiffat15")),
      csDiffAt15: toNumber(get("csdiffat15")),
    });
    matchedLines += 1;
  }

  return { rows, totalLines, matchedLines };
}

function playerCandidatesByName(players: ExistingPlayer[]) {
  const map = new Map<string, ExistingPlayer[]>();

  for (const player of players) {
    const keys = [player.name, player.slug, player.leaguepedia_page].filter(Boolean) as string[];
    for (const key of keys) {
      const normalized = normalizeName(key);
      const list = map.get(normalized) ?? [];
      list.push(player);
      map.set(normalized, list);
    }
  }

  return map;
}

function resolvePlayer(
  row: CsvRow,
  playersByName: Map<string, ExistingPlayer[]>,
  set: SetRow,
) {
  const normalizedPlayerName = normalizeName(row.playerName);
  const normalizedSlug = normalizeName(slugify(row.playerName));
  const candidates = [
    ...(playersByName.get(normalizedPlayerName) ?? []),
    ...(playersByName.get(normalizedSlug) ?? []),
  ];

  if (candidates.length === 0) {
    return null;
  }

  const expectedTeamId = row.side === "blue" ? set.blue_team_id : set.red_team_id;
  const uniqueCandidates = Array.from(new Map(candidates.map((candidate) => [candidate.id, candidate])).values());
  let bestCandidate: ExistingPlayer | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of uniqueCandidates) {
    let score = 0;
    if (expectedTeamId && candidate.team_id === expectedTeamId) {
      score += 4;
    }
    if (normalizeName(candidate.position) === normalizeName(row.position)) {
      score += 2;
    }
    if (normalizeName(candidate.name) === normalizedPlayerName) {
      score += 1;
    }
    if (normalizeName(candidate.slug) === normalizedSlug) {
      score += 1;
    }

    if (score > bestScore) {
      bestCandidate = candidate;
      bestScore = score;
    }
  }

  return bestCandidate;
}

function championKey(name: string) {
  return normalizeName(name).replace(/\s+/g, "");
}

async function ensureChampions(
  supabase: SupabaseClient,
  championNames: string[],
) {
  const normalizedNames = Array.from(
    new Set(championNames.map((name) => String(name ?? "").trim()).filter(Boolean)),
  );
  const { data, error } = await supabase
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
      byName.set(championKey(value), champion.id);

      const catalogEntry = championCatalogEntryForValue(value);
      if (catalogEntry) {
        for (const catalogValue of [catalogEntry.ddragon_id, catalogEntry.slug, catalogEntry.name]) {
          byName.set(normalizeName(catalogValue), champion.id);
          byName.set(championKey(catalogValue), champion.id);
        }
      }
    }
  }

  for (const champion of (data ?? []) as ExistingChampion[]) {
    addChampionKeys(champion);
  }

  const missing = normalizedNames.filter((name) => {
    const catalogEntry = championCatalogEntryForValue(name);
    return (
      !byName.has(normalizeName(name)) &&
      !byName.has(championKey(name)) &&
      !byName.has(normalizeName(catalogEntry?.ddragon_id)) &&
      !byName.has(championKey(catalogEntry?.ddragon_id ?? ""))
    );
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

    for (const champion of (inserted ?? []) as ExistingChampion[]) {
      addChampionKeys(champion);
    }
  }

  return byName;
}

function championIdFor(map: Map<string, string>, name: string | null | undefined) {
  const normalized = String(name ?? "").trim();
  if (!normalized) {
    return null;
  }

  return (
    map.get(normalizeName(normalized)) ??
    map.get(championKey(normalized)) ??
    map.get(normalizeName(normalized.replace(/\s+/g, ""))) ??
    null
  );
}

async function main() {
  loadEnvFile();
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const csvPath = process.argv[2] ?? "data/set/2026_LoL_esports_match_data_from_OraclesElixir.csv";

  const [{ data: sets, error: setsError }, { data: players, error: playersError }, { data: existingStats, error: existingStatsError }] = await Promise.all([
    supabase
      .from("sets")
      .select("id, riot_platform_game_id, blue_team_id, red_team_id")
      .not("riot_platform_game_id", "is", null),
    supabase
      .from("players")
      .select("id, slug, name, team_id, position, leaguepedia_page"),
    supabase
      .from("set_player_stats")
      .select("set_id, player_id, item0, item1, item2, item3, item4, item5, item6, spell0, spell1, rune0, rune1"),
  ]);

  if (setsError) throw setsError;
  if (playersError) throw playersError;
  if (existingStatsError) throw existingStatsError;

  const setByGameId = new Map(
    (sets ?? []).map((row) => [row.riot_platform_game_id as string, row as SetRow]),
  );
  const playersByName = playerCandidatesByName(players as ExistingPlayer[]);
  const buildBySetPlayer = new Map(
    (existingStats ?? []).map((stat) => [
      `${stat.set_id}:${stat.player_id}`,
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
      } satisfies ExistingBuild,
    ]),
  );

  const { rows, totalLines, matchedLines } = await readCsvRows(csvPath, setByGameId);
  if (rows.length === 0) {
    console.log(JSON.stringify({
      csvPath,
      totalLines,
      matchedLines,
      message: "매칭된 CSV 행이 없습니다.",
    }, null, 2));
    return;
  }

  const championNames = Array.from(new Set(rows.map((row) => row.champion).filter(Boolean)));
  const championMap = await ensureChampions(supabase, championNames);

  const missingPlayerCandidates = new Map<
    string,
    {
      slug: string;
      name: string;
      team_id: string | null;
      position: string;
      leaguepedia_page: string | null;
      source_player_id: string | null;
      is_starter: boolean;
      is_lck_player: boolean;
      imported_scope: "lck" | "international_event" | "manual";
      is_active: boolean;
    }
  >();

  const teamIds = Array.from(
    new Set(
      rows
        .map((row) => {
          const set = setByGameId.get(row.riotPlatformGameId);
          return row.side === "blue" ? set?.blue_team_id : set?.red_team_id;
        })
        .filter((teamId): teamId is string => Boolean(teamId)),
    ),
  );

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, is_lck_team")
    .in("id", teamIds);

  if (teamsError) {
    throw teamsError;
  }

  const teamById = new Map((teams ?? []).map((team) => [team.id, team as TeamRow]));
  for (const row of rows) {
    const set = setByGameId.get(row.riotPlatformGameId);
    if (!set) {
      continue;
    }

    const player = resolvePlayer(row, playersByName, set);
    if (player) {
      continue;
    }

    const slug = slugify(row.playerName);
    if (!slug) {
      continue;
    }

    const teamId = row.side === "blue" ? set.blue_team_id : row.side === "red" ? set.red_team_id : null;
    const team = teamId ? teamById.get(teamId) : null;
    const importedScope = team?.is_lck_team === false ? "international_event" : "lck";

    missingPlayerCandidates.set(slug, {
      slug,
      name: row.playerName,
      team_id: teamId,
      position: row.position,
      leaguepedia_page: null,
      source_player_id: null,
      is_starter: false,
      is_lck_player: team?.is_lck_team ?? true,
      imported_scope: importedScope,
      is_active: true,
    });
  }

  if (missingPlayerCandidates.size > 0) {
    const payload = Array.from(missingPlayerCandidates.values());
    const { data: insertedPlayers, error: insertPlayersError } = await supabase
      .from("players")
      .upsert(payload, { onConflict: "slug" })
      .select("id, slug, name, team_id, position, leaguepedia_page");

    if (insertPlayersError) {
      throw insertPlayersError;
    }

    for (const player of (insertedPlayers ?? []) as ExistingPlayer[]) {
      const keys = [player.name, player.slug, player.leaguepedia_page].filter(Boolean) as string[];
      for (const key of keys) {
        const normalized = normalizeName(key);
        const list = playersByName.get(normalized) ?? [];
        if (!list.some((entry) => entry.id === player.id)) {
          list.push(player);
          playersByName.set(normalized, list);
        }
      }
    }
  }

  const setIds = Array.from(new Set(rows.map((row) => row.setId)));
  const { error: deleteError } = await supabase
    .from("set_player_stats")
    .delete()
    .in("set_id", setIds);

  if (deleteError) {
    throw deleteError;
  }

  const payload = rows.flatMap((row) => {
    const set = setByGameId.get(row.riotPlatformGameId);
    if (!set) {
      return [];
    }

    const player = resolvePlayer(row, playersByName, set);
    const championId = championIdFor(championMap, row.champion);
    if (!player || !championId) {
      return [];
    }

    const preservedBuild = buildBySetPlayer.get(`${set.id}:${player.id}`);
    const teamId =
      row.side === "blue"
        ? set.blue_team_id
        : row.side === "red"
          ? set.red_team_id
          : player.team_id;

    if (!teamId) {
      return [];
    }

    return [
      {
        set_id: set.id,
        player_id: player.id,
        team_id: teamId,
        side: row.side,
        position: row.position,
        champion_id: championId,
        kills: row.kills ?? 0,
        deaths: row.deaths ?? 0,
        assists: row.assists ?? 0,
        cs: row.cs ?? 0,
        gold: row.gold ?? 0,
        damage_to_champions: row.damageToChampions ?? 0,
        vision_score: row.visionScore ?? 0,
        wards_placed: row.wardsPlaced ?? 0,
        wards_killed: row.wardsKilled ?? 0,
        dpm: row.dpm,
        damage_share: row.damageShare,
        vision_score_per_minute: row.visionScorePerMinute,
        cs_per_minute: row.csPerMinute,
        gold_diff_at_10: row.goldDiffAt10,
        xp_diff_at_10: row.xpDiffAt10,
        cs_diff_at_10: row.csDiffAt10,
        gold_diff_at_15: row.goldDiffAt15,
        xp_diff_at_15: row.xpDiffAt15,
        cs_diff_at_15: row.csDiffAt15,
        ...(preservedBuild ?? {}),
      },
    ];
  });

  const chunkSize = 500;
  let inserted = 0;
  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize);
    const { error } = await supabase.from("set_player_stats").insert(chunk);
    if (error) {
      throw error;
    }
    inserted += chunk.length;
  }

  const matchedSetCount = new Set(rows.map((row) => row.setId)).size;
  const matchedPlayerCount = new Set(payload.map((row) => `${row.set_id}:${row.player_id}`)).size;
  const skippedRows = rows.length - payload.length;

  console.log(
    JSON.stringify(
      {
        csvPath,
        totalLines,
        matchedLines,
        matchedSetCount,
        matchedPlayerCount,
        inserted,
        skippedRows,
        note: "set_picks_bans는 CSV의 pick 순서가 불완전해서 이번 스크립트에서 제외했습니다.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
