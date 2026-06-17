import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type MatchRow = {
  id: string;
  leaguepedia_match_id: string | null;
  name: string;
  match_date: string;
};

type CargoSetRow = {
  MatchId?: string;
  N_GameInMatch?: string;
  GameId?: string;
  RiotPlatformGameId?: string;
  RiotGameId?: string;
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

function parseInteger(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`https://lol.fandom.com/api.php?${params.toString()}`, {
      headers: {
        "user-agent": "LCKHubMinion/0.1 (leaguepedia set id backfill; contact: local-dev)",
      },
    });

    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 2)));
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
      await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 2)));
      continue;
    }

    if (body.error) {
      throw new Error(`Leaguepedia 세트 조회 오류: ${body.error.info ?? body.error.code}`);
    }

    return (body.cargoquery ?? []).map((entry) => entry.title);
  }

  throw new Error("Leaguepedia 요청 제한으로 세트 정보를 가져오지 못했습니다.");
}

function buildMatchWhere(alias: string, matchIds: string[]) {
  return matchIds.map((matchId) => `${alias}.MatchId="${escapeCargoValue(matchId)}"`).join(" OR ");
}

async function fetchLeaguepediaGameRows(leaguepediaMatchIds: string[]) {
  const [scoreboardRows, scheduleRows] = await Promise.all([
    cargoQuery({
      tables: "ScoreboardGames=SG",
      fields: [
        "SG.MatchId=MatchId",
        "SG.N_GameInMatch=N_GameInMatch",
        "SG.RiotPlatformGameId=RiotPlatformGameId",
        "SG.RiotGameId=RiotGameId",
      ].join(","),
      where: buildMatchWhere("SG", leaguepediaMatchIds),
      order_by: "SG.N_GameInMatch ASC",
    }),
    cargoQuery({
      tables: "MatchScheduleGame=MSG",
      fields: [
        "MSG.MatchId=MatchId",
        "MSG.GameId=GameId",
        "MSG.N_GameInMatch=N_GameInMatch",
      ].join(","),
      where: buildMatchWhere("MSG", leaguepediaMatchIds),
      order_by: "MSG.N_GameInMatch ASC",
    }),
  ]);

  const scoreboardByMatch = new Map<string, CargoSetRow[]>();
  for (const row of scoreboardRows as CargoSetRow[]) {
    const matchId = row.MatchId;
    if (!matchId) continue;
    const items = scoreboardByMatch.get(matchId) ?? [];
    items.push(row);
    scoreboardByMatch.set(matchId, items);
  }

  const scheduleByMatch = new Map<string, CargoSetRow[]>();
  for (const row of scheduleRows as CargoSetRow[]) {
    const matchId = row.MatchId;
    if (!matchId) continue;
    const items = scheduleByMatch.get(matchId) ?? [];
    items.push(row);
    scheduleByMatch.set(matchId, items);
  }

  return leaguepediaMatchIds.flatMap((matchId) => {
    const scoreRows = scoreboardByMatch.get(matchId) ?? [];
    const schedRows = scheduleByMatch.get(matchId) ?? [];
    const scheduleBySetNumber = new Map(schedRows.map((row) => [parseInteger(row.N_GameInMatch), row]));

    return scoreRows.map((row, index) => ({
      ...row,
      ...(scheduleBySetNumber.get(parseInteger(row.N_GameInMatch)) ??
        scheduleBySetNumber.get(index + 1)),
    }));
  });
}

async function main() {
  loadEnvFile();

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, leaguepedia_match_id, name, match_date")
    .not("leaguepedia_match_id", "is", null)
    .neq("leaguepedia_match_id", "")
    .order("match_date", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (matches ?? []) as MatchRow[];
  let matchesProcessed = 0;
  let setsUpdated = 0;
  const chunkSize = 50;

  const matchGroups = rows.filter((match) => match.leaguepedia_match_id);

  for (let index = 0; index < matchGroups.length; index += chunkSize) {
    const batch = matchGroups.slice(index, index + chunkSize);
    const batchIds = batch.map((match) => match.leaguepedia_match_id!).filter(Boolean);
    const setRows = await fetchLeaguepediaGameRows(batchIds);

    const setRowsByMatch = new Map<string, CargoSetRow[]>();
    for (const row of setRows) {
      const matchId = row.MatchId;
      if (!matchId) continue;
      const items = setRowsByMatch.get(matchId) ?? [];
      items.push(row);
      setRowsByMatch.set(matchId, items);
    }

    for (const match of batch) {
      const leaguepediaMatchId = match.leaguepedia_match_id!;
      const rowsForMatch = setRowsByMatch.get(leaguepediaMatchId) ?? [];

      if (rowsForMatch.length === 0) {
        console.log(JSON.stringify({ matchId: match.id, leaguepediaMatchId, skipped: "no_leaguepedia_rows" }));
        continue;
      }

      for (const [rowIndex, row] of rowsForMatch.entries()) {
        const setNumber = parseInteger(row.N_GameInMatch) ?? rowIndex + 1;
        const { data, error: updateError } = await supabase
          .from("sets")
          .update({
            leaguepedia_game_id: row.GameId || null,
            riot_platform_game_id: row.RiotPlatformGameId || null,
          })
          .eq("match_id", match.id)
          .eq("set_number", setNumber)
          .select("id");

        if (updateError) {
          throw updateError;
        }

        setsUpdated += data?.length ?? 0;
      }

      matchesProcessed += 1;
      console.log(JSON.stringify({
        matchId: match.id,
        leaguepediaMatchId,
        sets: rowsForMatch.length,
      }));
    }
  }

  console.log(JSON.stringify({ matchesProcessed, setsUpdated }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
