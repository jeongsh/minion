import type { SupabaseClient } from "@supabase/supabase-js";

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 5000;
const RATE_LIMIT_BASE_MS = 20000;
const MAX_RETRIES = 15;
const PAGE_DELAY_MS = 15000;

export type PomSyncMode = "incremental" | "full";

export type PomSyncSummary = {
  mode: PomSyncMode;
  overviewPagesFetched: number;
  matchesChecked: number;
  matchesUpdated: number;
  skipped: Array<{ matchId: string; leaguepediaMatchId: string; reason: string }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cargoQuery(
  query: Record<string, string>,
  offset = 0,
  onRetry?: (waitMs: number) => void,
): Promise<Array<Record<string, string>>> {
  const params = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    limit: "500",
    offset: String(offset),
  });

  for (const [key, value] of Object.entries(query)) {
    params.set(key, value);
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(`${CARGO_API}?${params.toString()}`, {
      headers: { "user-agent": "LCKHubMinion/0.1 (POM sync; contact: local-dev)" },
    });

    if (!response.ok) throw new Error(`Leaguepedia fetch failed: ${response.status}`);

    const body = (await response.json()) as {
      cargoquery?: Array<{ title: Record<string, string> }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      const waitMs = RATE_LIMIT_BASE_MS * (attempt + 1);
      onRetry?.(waitMs);
      await sleep(waitMs);
      continue;
    }

    if (body.error) {
      throw new Error(`Leaguepedia cargo error: ${body.error.info ?? body.error.code}`);
    }

    return (body.cargoquery ?? []).map((entry) => entry.title);
  }

  throw new Error("Leaguepedia rate limit retries exhausted.");
}

async function fetchPomForOverviewPage(
  overviewPage: string,
  onRetry?: (waitMs: number) => void,
): Promise<Map<string, string>> {
  const pomMap = new Map<string, string>();
  let offset = 0;

  while (true) {
    const rows = await cargoQuery(
      {
        tables: "MatchSchedule=MS",
        fields: "MS.MatchId, MS.MVP",
        where: `MS.OverviewPage="${overviewPage}" AND MS.MVP IS NOT NULL AND MS.MVP != ""`,
        order_by: "MS.DateTime_UTC",
        order_by_options: "ASC",
      },
      offset,
      onRetry,
    );

    for (const row of rows) {
      const matchId = row["MatchId"];
      const mvp = row["MVP"]?.trim();
      if (matchId && mvp) {
        pomMap.set(matchId, mvp);
      }
    }

    if (rows.length < 500) break;
    offset += 500;
    await sleep(PAGE_DELAY_MS);
  }

  return pomMap;
}

function extractOverviewPage(leaguepediaMatchId: string): string | null {
  if (leaguepediaMatchId.startsWith("gol:")) return null;
  const underscoreIdx = leaguepediaMatchId.indexOf("_");
  if (underscoreIdx === -1) return null;
  return leaguepediaMatchId.slice(0, underscoreIdx);
}

export async function syncPom(
  supabase: SupabaseClient,
  options: {
    mode?: PomSyncMode;
    onRetry?: (waitMs: number) => void;
    onProgress?: (message: string) => void;
  } = {},
): Promise<PomSyncSummary> {
  const mode = options.mode ?? "incremental";
  const { onRetry, onProgress } = options;

  const summary: PomSyncSummary = {
    mode,
    overviewPagesFetched: 0,
    matchesChecked: 0,
    matchesUpdated: 0,
    skipped: [],
  };

  // 1. Get matches that need POM data
  let dbQuery = supabase
    .from("matches")
    .select("id, leaguepedia_match_id")
    .not("leaguepedia_match_id", "is", null)
    .neq("leaguepedia_match_id", "");

  if (mode === "incremental") {
    dbQuery = dbQuery.is("official_pom_player_id", null);
  }

  const { data: matches, error: matchesError } = await dbQuery;
  if (matchesError) throw matchesError;

  summary.matchesChecked = matches.length;
  onProgress?.(`Found ${matches.length} matches to check.`);

  // 2. Extract unique overview pages from leaguepedia_match_id
  const overviewPages = new Set<string>();
  for (const match of matches) {
    const page = extractOverviewPage(match.leaguepedia_match_id);
    if (page) overviewPages.add(page);
  }

  // 3. Fetch MVP data from Leaguepedia per overview page
  const globalPomMap = new Map<string, string>(); // leaguepedia MatchId → MVP player name
  for (const overviewPage of overviewPages) {
    onProgress?.(`Fetching POM from Leaguepedia: ${overviewPage}`);
    const pomMap = await fetchPomForOverviewPage(overviewPage, onRetry);
    for (const [matchId, mvp] of pomMap) {
      globalPomMap.set(matchId, mvp);
    }
    summary.overviewPagesFetched++;
    await sleep(PAGE_DELAY_MS);
  }

  onProgress?.(`Leaguepedia returned MVP data for ${globalPomMap.size} matches.`);

  // 4. Get all players for name lookup
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name");
  if (playersError) throw playersError;

  const playerByName = new Map(
    players.map((p) => [p.name.toLowerCase(), p.id]),
  );

  // Leaguepedia sometimes returns "GameName (Real Name)" — extract just the game name
  function resolvePlayerId(mvpRaw: string): string | undefined {
    const gameName = mvpRaw.replace(/\s*\(.*\)\s*$/, "").trim();
    return playerByName.get(gameName.toLowerCase());
  }

  // 5. Update matches with the POM player ID
  for (const match of matches) {
    const mvpName = globalPomMap.get(match.leaguepedia_match_id);
    if (!mvpName) {
      summary.skipped.push({
        matchId: match.id,
        leaguepediaMatchId: match.leaguepedia_match_id,
        reason: "no_pom_in_leaguepedia",
      });
      continue;
    }

    const playerId = resolvePlayerId(mvpName);
    if (!playerId) {
      summary.skipped.push({
        matchId: match.id,
        leaguepediaMatchId: match.leaguepedia_match_id,
        reason: `player_not_found:${mvpName}`,
      });
      continue;
    }

    const { error } = await supabase
      .from("matches")
      .update({ official_pom_player_id: playerId })
      .eq("id", match.id);

    if (error) throw error;
    summary.matchesUpdated++;
  }

  return summary;
}
