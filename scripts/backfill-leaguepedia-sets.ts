import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  MatchId?: string;
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
};

type CargoScheduleGameRow = {
  MatchId?: string;
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
  if (!value) throw new Error(`${name} is required.`);
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
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGold(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
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
  if (!team) return [];
  return [team.id, team.slug, team.name, team.short_name, team.leaguepedia_page]
    .filter(Boolean)
    .map((value) => normalizeName(String(value)));
}

function resolveTeamId(value: string | null | undefined, match: MatchRow) {
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
  if (winner === 1) return resolveTeamId(row.Team1, match);
  if (winner === 2) return resolveTeamId(row.Team2, match);

  const sideWinner = parseInteger(row.SideWinner);
  if (sideWinner === 1) return resolveTeamId(row.Blue, match);
  if (sideWinner === 2) return resolveTeamId(row.Red, match);

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
  if (!sideTeamId) return null;

  const team1Id = resolveTeamId(row.Team1, match);
  const team2Id = resolveTeamId(row.Team2, match);
  if (sideTeamId === team1Id) return team1Value;
  if (sideTeamId === team2Id) return team2Value;
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

async function cargoQuery(query: Record<string, string>) {
  const params = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    limit: "500",
  });
  for (const [key, value] of Object.entries(query)) {
    params.set(key, value);
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(`https://lol.fandom.com/api.php?${params.toString()}`, {
      headers: {
        "user-agent": "LCKHubMinion/0.1 (leaguepedia set backfill; contact: local-dev)",
      },
    });

    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      await sleep(Math.min(60_000, 5000 * (attempt + 1)));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Leaguepedia 조회 실패: ${response.status}`);
    }

    const body = (await response.json()) as {
      cargoquery?: Array<{ title: Record<string, string> }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      await sleep(Math.min(60_000, 5000 * (attempt + 1)));
      continue;
    }

    if (body.error) {
      throw new Error(`Leaguepedia 조회 오류: ${body.error.info ?? body.error.code}`);
    }

    return (body.cargoquery ?? []).map((entry) => entry.title);
  }

  throw new Error("Leaguepedia 요청 제한으로 조회하지 못했습니다.");
}

function buildMatchWhere(alias: string, matchIds: string[]) {
  return matchIds.map((matchId) => `${alias}.MatchId="${matchId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(" OR ");
}

async function fetchLeaguepediaSetRows(matchIds: string[]) {
  const [scoreboardRows, scheduleRows] = await Promise.all([
    cargoQuery({
      tables: "ScoreboardGames=SG",
      fields: [
        "SG.MatchId=MatchId",
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
      where: buildMatchWhere("SG", matchIds),
      order_by: "SG.N_GameInMatch ASC",
    }),
    cargoQuery({
      tables: "MatchScheduleGame=MSG",
      fields: [
        "MSG.MatchId=MatchId",
        "MSG.GameId=GameId",
        "MSG.N_GameInMatch=N_GameInMatch",
        "MSG.Blue=Blue",
        "MSG.Red=Red",
        "MSG.Winner=SideWinner",
      ].join(","),
      where: buildMatchWhere("MSG", matchIds),
      order_by: "MSG.N_GameInMatch ASC",
    }),
  ]);

  const scoreByMatch = new Map<string, CargoSetRow[]>();
  for (const row of scoreboardRows as CargoSetRow[]) {
    if (!row.MatchId) continue;
    const list = scoreByMatch.get(row.MatchId) ?? [];
    list.push(row);
    scoreByMatch.set(row.MatchId, list);
  }

  const scheduleByMatch = new Map<string, CargoScheduleGameRow[]>();
  for (const row of scheduleRows as CargoScheduleGameRow[]) {
    if (!row.MatchId) continue;
    const list = scheduleByMatch.get(row.MatchId) ?? [];
    list.push(row);
    scheduleByMatch.set(row.MatchId, list);
  }

  return matchIds.flatMap((matchId) => {
    const scoreRows = scoreByMatch.get(matchId) ?? [];
    const schedRows = scheduleByMatch.get(matchId) ?? [];
    const scheduleBySetNumber = new Map(
      schedRows.map((row) => [parseInteger(row.N_GameInMatch), row]),
    );

    return scoreRows.map((row, index) => ({
      ...row,
      ...(scheduleBySetNumber.get(parseInteger(row.N_GameInMatch)) ??
        scheduleBySetNumber.get(index + 1)),
    }));
  });
}

function isLckTeamId(teamId: string | null, match: MatchRow) {
  if (!teamId) return true;
  if (match.team_a?.id === teamId) return match.team_a.is_lck_team ?? true;
  if (match.team_b?.id === teamId) return match.team_b.is_lck_team ?? true;
  return true;
}

function splitIntoChunks<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function main() {
  loadEnvFile();
  const force = process.argv.includes("--force");

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      "id, leaguepedia_match_id, team_a_id, team_b_id, team_a:team_a_id(id, slug, name, short_name, leaguepedia_page, is_lck_team), team_b:team_b_id(id, slug, name, short_name, leaguepedia_page, is_lck_team), sets(id)",
    )
    .not("leaguepedia_match_id", "is", null)
    .neq("leaguepedia_match_id", "")
    .order("match_date", { ascending: true });

  if (error) throw error;

  const matchRows = ((matches ?? [])
    .filter((match) => {
      if (force) return true;
      return (
        !("sets" in match) ||
        !Array.isArray((match as { sets?: unknown[] }).sets) ||
        ((match as { sets?: unknown[] }).sets?.length ?? 0) === 0
      );
    })) as unknown as MatchRow[];
  const chunks = splitIntoChunks(matchRows, 10);
  let createdOrUpdated = 0;

  for (const batch of chunks) {
    const batchIds = batch.map((match) => match.leaguepedia_match_id!).filter(Boolean);
    let leaguepediaRows: MergedCargoSetRow[] = [];
    for (let batchAttempt = 0; batchAttempt < 5; batchAttempt += 1) {
      try {
        leaguepediaRows = await fetchLeaguepediaSetRows(batchIds);
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const rateLimited = message.includes("요청 제한");
        if (!rateLimited || batchAttempt === 4) throw error;
        const waitMs = 90_000 * (batchAttempt + 1);
        console.log(JSON.stringify({ rateLimited: true, batchAttempt: batchAttempt + 1, waitMs }));
        await sleep(waitMs);
      }
    }

    const rowsByMatch = new Map<string, MergedCargoSetRow[]>();
    for (const row of leaguepediaRows) {
      if (!row.MatchId) continue;
      const list = rowsByMatch.get(row.MatchId) ?? [];
      list.push(row);
      rowsByMatch.set(row.MatchId, list);
    }

    for (const match of batch) {
      const leaguepediaMatchId = match.leaguepedia_match_id!;
      const rowsForMatch = rowsByMatch.get(leaguepediaMatchId) ?? [];

      if (rowsForMatch.length === 0) {
        console.log(JSON.stringify({ matchId: match.id, leaguepediaMatchId, skipped: "no_leaguepedia_rows" }));
        continue;
      }

      const payload = rowsForMatch.map((row, index) => {
        const setNumber = parseInteger(row.N_GameInMatch) ?? index + 1;
        const blueTeamId = resolveTeamId(row.Blue, match);
        const redTeamId = resolveTeamId(row.Red, match);

        return {
          match_id: match.id,
          set_number: setNumber,
          winner_team_id: winnerTeamId(row, match),
          blue_team_id: blueTeamId,
          red_team_id: redTeamId,
          duration_seconds: parseDurationSeconds(row.Gamelength),
          blue_kills: parseInteger(
            statForSide({
              sideTeamId: blueTeamId,
              row,
              match,
              team1Value: row.Team1Kills,
              team2Value: row.Team2Kills,
            }),
          ),
          red_kills: parseInteger(
            statForSide({
              sideTeamId: redTeamId,
              row,
              match,
              team1Value: row.Team1Kills,
              team2Value: row.Team2Kills,
            }),
          ),
          blue_gold: goldForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1Gold,
            team2Value: row.Team2Gold,
          }),
          red_gold: goldForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1Gold,
            team2Value: row.Team2Gold,
          }),
          blue_dragons: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1Dragons,
            team2Value: row.Team2Dragons,
          }),
          red_dragons: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1Dragons,
            team2Value: row.Team2Dragons,
          }),
          blue_clouds: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1Clouds,
            team2Value: row.Team2Clouds,
          }),
          red_clouds: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1Clouds,
            team2Value: row.Team2Clouds,
          }),
          blue_infernals: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1Infernals,
            team2Value: row.Team2Infernals,
          }),
          red_infernals: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1Infernals,
            team2Value: row.Team2Infernals,
          }),
          blue_mountains: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1Mountains,
            team2Value: row.Team2Mountains,
          }),
          red_mountains: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1Mountains,
            team2Value: row.Team2Mountains,
          }),
          blue_oceans: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1Oceans,
            team2Value: row.Team2Oceans,
          }),
          red_oceans: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1Oceans,
            team2Value: row.Team2Oceans,
          }),
          blue_hextechs: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1Hextechs,
            team2Value: row.Team2Hextechs,
          }),
          red_hextechs: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1Hextechs,
            team2Value: row.Team2Hextechs,
          }),
          blue_chemtechs: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1Chemtechs,
            team2Value: row.Team2Chemtechs,
          }),
          red_chemtechs: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1Chemtechs,
            team2Value: row.Team2Chemtechs,
          }),
          blue_elders: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1Elders,
            team2Value: row.Team2Elders,
          }),
          red_elders: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1Elders,
            team2Value: row.Team2Elders,
          }),
          blue_rift_heralds: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1RiftHeralds,
            team2Value: row.Team2RiftHeralds,
          }),
          red_rift_heralds: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1RiftHeralds,
            team2Value: row.Team2RiftHeralds,
          }),
          blue_void_grubs: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1VoidGrubs,
            team2Value: row.Team2VoidGrubs,
          }),
          red_void_grubs: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1VoidGrubs,
            team2Value: row.Team2VoidGrubs,
          }),
          blue_barons: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1Barons,
            team2Value: row.Team2Barons,
          }),
          red_barons: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1Barons,
            team2Value: row.Team2Barons,
          }),
          blue_towers: parsedStatForSide({
            sideTeamId: blueTeamId,
            row,
            match,
            team1Value: row.Team1Towers,
            team2Value: row.Team2Towers,
          }),
          red_towers: parsedStatForSide({
            sideTeamId: redTeamId,
            row,
            match,
            team1Value: row.Team1Towers,
            team2Value: row.Team2Towers,
          }),
          patch: row.Patch || null,
          leaguepedia_game_id: row.ScheduleGameId || row.GameId || null,
          riot_match_id: row.RiotGameId || null,
          riot_platform_game_id: row.RiotPlatformGameId || null,
        };
      });

      const { data, error: upsertError } = await supabase
        .from("sets")
        .upsert(payload, { onConflict: "match_id,set_number" })
        .select("id");

      if (upsertError) {
        throw upsertError;
      }

      createdOrUpdated += data?.length ?? 0;
      console.log(JSON.stringify({
        matchId: match.id,
        leaguepediaMatchId,
        sets: payload.length,
      }));
    }

    await sleep(30000);
  }

  console.log(JSON.stringify({
    force,
    matchesProcessed: matchRows.length,
    setsUpserted: createdOrUpdated,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
