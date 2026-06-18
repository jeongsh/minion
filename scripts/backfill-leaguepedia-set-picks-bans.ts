import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { championCatalogEntryForValue } from "../lib/champions";

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

type SetRow = {
  id: string;
  match_id: string;
  set_number: number;
  leaguepedia_game_id: string | null;
  blue_team_id: string | null;
  red_team_id: string | null;
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
  MatchId?: string;
};

type ExistingChampion = {
  id: string;
  slug: string;
  name: string;
  ddragon_id?: string | null;
};

const CARGO_API = "https://lol.fandom.com/api.php";
const MAX_RETRIES = 8;
const MATCH_CHUNK_SIZE = 20;
const REQUEST_DELAY_MS = 10000;

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
    // optional
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseInteger(value: string | null | undefined) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
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

function normalizeChampionName(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string) {
  return normalizeName(value)
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function championKey(name: string) {
  return normalizeName(name).replace(/\s+/g, "");
}

function championIdFor(map: Map<string, string>, name: string | null | undefined) {
  const normalized = normalizeChampionName(name);
  return (
    map.get(normalizeName(normalized)) ??
    map.get(championKey(normalized)) ??
    map.get(normalizeName(normalized.replace(/\s+/g, ""))) ??
    null
  );
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
    if (!championId) {
      return;
    }
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
        "user-agent": "LCKHubMinion/0.1 (Leaguepedia picks bans backfill; contact: local-dev)",
      },
    });

    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Leaguepedia pick/ban 조회 실패: ${response.status}`);
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
      throw new Error(`Leaguepedia pick/ban 조회 오류: ${body.error.info ?? body.error.code}`);
    }

    return (body.cargoquery ?? []).map((entry) => entry.title);
  }

  throw new Error("Leaguepedia 요청 제한으로 pick/ban 정보를 가져오지 못했습니다.");
}

function escapeCargoValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function fetchPickBanRows(leaguepediaMatchIds: string[]) {
  if (leaguepediaMatchIds.length === 0) {
    return [] as CargoPickBanRow[];
  }

  return cargoQuery({
    tables: "PicksAndBansS7=PB",
    fields: [
      "PB.MatchId=MatchId",
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
    where: leaguepediaMatchIds
      .map((matchId) => `PB.MatchId="${escapeCargoValue(matchId)}"`)
      .join(" OR "),
    order_by: "PB.MatchId ASC, PB.N_GameInMatch ASC",
  }) as Promise<CargoPickBanRow[]>;
}

async function ensureChampions(
  supabase: SupabaseClient,
  championNames: string[],
) {
  const normalizedNames = Array.from(
    new Set(championNames.map((name) => String(name ?? "").trim()).filter(Boolean)),
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

  for (const champion of (existing ?? []) as ExistingChampion[]) {
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

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

async function main() {
  loadEnvFile();
  const force = process.argv.includes("--force");

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const [
    { data: matches, error: matchesError },
    { data: sets, error: setsError },
    { data: existingPb, error: pbError },
  ] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, leaguepedia_match_id, team_a_id, team_b_id, team_a:team_a_id(id, slug, name, short_name, leaguepedia_page, is_lck_team), team_b:team_b_id(id, slug, name, short_name, leaguepedia_page, is_lck_team)",
      )
      .not("leaguepedia_match_id", "is", null)
      .order("match_date", { ascending: true }),
    supabase
      .from("sets")
      .select("id, match_id, set_number, leaguepedia_game_id, blue_team_id, red_team_id"),
    force
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("set_picks_bans").select("set_id"),
  ]);
  if (pbError) throw pbError;

  if (matchesError) {
    throw matchesError;
  }
  if (setsError) {
    throw setsError;
  }

  const typedMatches = (matches ?? []) as unknown as MatchRow[];
  const typedSets = (sets ?? []) as SetRow[];
  const setsByMatchId = new Map<string, SetRow[]>();
  for (const set of typedSets) {
    const list = setsByMatchId.get(set.match_id) ?? [];
    list.push(set);
    setsByMatchId.set(set.match_id, list);
  }

  // --force 없으면 밴픽 데이터가 없는 세트만 처리
  const setsWithPickBans = new Set((existingPb ?? []).map((r) => r.set_id as string));
  if (!force) {
    console.log(`이미 밴픽 있는 세트: ${setsWithPickBans.size}개 (전체 덮어쓰기: --force)`);
  }

  const eligibleMatches = typedMatches.filter((match) => {
    const matchSets = setsByMatchId.get(match.id) ?? [];
    if (matchSets.length === 0) return false;
    return force || matchSets.some((s) => !setsWithPickBans.has(s.id));
  });
  const matchChunks = chunk(eligibleMatches, MATCH_CHUNK_SIZE);
  let matchesProcessed = 0;
  let rowsFetched = 0;
  let rowsInserted = 0;

  for (const group of matchChunks) {
    const leaguepediaMatchIds = group.map((match) => match.leaguepedia_match_id!).filter(Boolean);
    const pickBanRows = await fetchPickBanRows(leaguepediaMatchIds);
    rowsFetched += pickBanRows.length;

    const championNames = Array.from(
      new Set(
        pickBanRows.flatMap((row) => [
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
        ]).filter(Boolean) as string[],
      ),
    );
    const championMap = await ensureChampions(supabase, championNames);

    const setByNumberByMatchId = new Map<string, Map<number, SetRow>>();
    const setByGameIdByMatchId = new Map<string, Map<string, SetRow>>();
    const setIds = new Set<string>();

    for (const match of group) {
      const matchSets = setsByMatchId.get(match.id) ?? [];
      setByNumberByMatchId.set(
        match.id,
        new Map(matchSets.map((set) => [set.set_number, set])),
      );
      setByGameIdByMatchId.set(
        match.id,
        new Map(
          matchSets
            .filter((set) => set.leaguepedia_game_id)
            .map((set) => [set.leaguepedia_game_id!, set]),
        ),
      );
      for (const set of matchSets) {
        if (!force && setsWithPickBans.has(set.id)) continue;
        setIds.add(set.id);
      }
    }

    if (setIds.size > 0) {
      const { error: deleteError } = await supabase
        .from("set_picks_bans")
        .delete()
        .in("set_id", Array.from(setIds));
      if (deleteError) {
        throw deleteError;
      }
    }

    const payload = pickBanRows.flatMap((row) => {
      const match = group.find((entry) => entry.leaguepedia_match_id === row.MatchId);
      if (!match) {
        return [];
      }

      const setByNumber = setByNumberByMatchId.get(match.id);
      const setByGameId = setByGameIdByMatchId.get(match.id);
      const setNumber = parseInteger(row.N_GameInMatch);
      const set =
        (setNumber ? setByNumber?.get(setNumber) : null) ??
        (row.GameId ? setByGameId?.get(row.GameId) : null);

      if (!set) {
        return [];
      }

      return pickBanRowsForSet({
        setId: set.id,
        row,
        match,
        blueTeamId: set.blue_team_id,
        redTeamId: set.red_team_id,
        championMap,
      });
    });

    if (payload.length > 0) {
      const { error: insertError } = await supabase
        .from("set_picks_bans")
        .insert(payload);
      if (insertError) {
        throw insertError;
      }
      rowsInserted += payload.length;
    }

    matchesProcessed += group.length;
    console.log(
      JSON.stringify(
        {
          matchesProcessed,
          matchesTotal: eligibleMatches.length,
          fetchedRows: rowsFetched,
          insertedRows: rowsInserted,
          setCountInChunk: setIds.size,
        },
        null,
        2,
      ),
    );

    if (group !== matchChunks[matchChunks.length - 1]) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  console.log(
    JSON.stringify(
      {
        matchesTotal: eligibleMatches.length,
        fetchedRows: rowsFetched,
        insertedRows: rowsInserted,
        note: "기존 set_picks_bans는 Leaguepedia 기준으로 다시 채웠습니다.",
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
