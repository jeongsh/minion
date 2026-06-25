import type { SupabaseClient } from "@supabase/supabase-js";

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 3000;
const RATE_LIMIT_BASE_MS = 20000;
const MAX_RETRIES = 10;

export type AwardsSyncSummary = {
  fetched: number;
  inserted: number;
  skipped: Array<{ tournament: string; team: string; place: string; reason: string }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cargoQuery(
  query: Record<string, string>,
  onRetry?: (waitMs: number) => void,
): Promise<Array<Record<string, string>>> {
  const params = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    limit: "500",
    ...query,
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(`${CARGO_API}?${params.toString()}`, {
      headers: { "user-agent": "LCKHubMinion/0.1 (awards sync; contact: local-dev)" },
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

// Leaguepedia 리그명 → award_type 매핑
const LEAGUE_TO_AWARD: Record<string, { champion: string; runnerUp: string } | undefined> = {
  "LoL Champions Korea":       { champion: "lck_champion",         runnerUp: "lck_runner_up" },
  "Mid-Season Invitational":   { champion: "msi_champion",          runnerUp: "msi_runner_up" },
  "World Championship":        { champion: "worlds_champion",       runnerUp: "worlds_runner_up" },
  "Esports World Cup":         { champion: "ewc_champion",          runnerUp: "ewc_runner_up" },
  "LoL First Stand":           { champion: "first_stand_champion",  runnerUp: "first_stand_runner_up" },
};

// Leaguepedia 팀명 → our slug (역대 팀명 포함)
const TEAM_NAME_TO_SLUG: Record<string, string> = {
  // T1
  "T1": "t1",
  "SK Telecom T1": "t1",
  "SKT T1": "t1",

  // Gen.G
  "Gen.G": "geng",
  "Gen.G Esports": "geng",
  "Samsung Galaxy": "geng",
  "KSV Esports": "geng",

  // KT Rolster
  "KT Rolster": "kt",
  "kt Rolster": "kt",
  "KT Bullets": "kt",
  "KT Arrows": "kt",

  // Dplus KIA
  "Dplus KIA": "dk",
  "DAMWON Gaming": "dk",
  "DAMWON KIA": "dk",
  "KOO Tigers": "dk",
  "GE Tigers": "dk",

  // DRX
  "DRX": "drx",
  "KIWOOM DRX": "drx",
  "DragonX": "drx",
  "bbq Olivers": "drx",
  "ROX Tigers": "drx",

  // Hanwha Life Esports
  "Hanwha Life Esports": "hle",
  "HLE": "hle",
  "CJ Entus": "hle",

  // BNK FearX
  "BNK FearX": "fox",
  "Team BattleComics": "fox",
  "BTC": "fox",

  // Brion
  "Brion": "bro",
  "한진 Brion": "bro",
  "Griffin": "bro",

  // Nongshim RedForce
  "Nongshim RedForce": "ns",
  "NongShim RedForce": "ns",
  "Jin Air Green Wings": "ns",

  // DN Freecs / Afreeca
  "DN Freecs": "soop",
  "DN Freecs Esports": "soop",
  "Afreeca Freecs": "soop",
  "AF": "soop",
};

export async function syncLckAwards(
  supabase: SupabaseClient,
  options: {
    fromYear?: number;
    force?: boolean;
    onRetry?: (waitMs: number) => void;
    onProgress?: (message: string) => void;
  } = {},
): Promise<AwardsSyncSummary> {
  const { fromYear = 2012, force = false, onRetry, onProgress } = options;

  const summary: AwardsSyncSummary = { fetched: 0, inserted: 0, skipped: [] };

  // 1. 팀 목록 가져오기
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, slug, name");
  if (teamsError) throw teamsError;

  const teamBySlug = new Map(teams.map((t) => [t.slug, t]));

  // 2. 기존 수상 내역 가져오기 (중복 체크용)
  const existingSet = new Set<string>();
  if (!force) {
    const { data: existing } = await supabase
      .from("team_awards")
      .select("team_id, year, award_type, tournament_name");
    for (const row of existing ?? []) {
      existingSet.add(`${row.team_id}::${row.year}::${row.award_type}::${row.tournament_name}`);
    }
  }

  // 3. Leaguepedia에서 상위 2위 결과 조회
  const leagues = Object.keys(LEAGUE_TO_AWARD).join('","');
  onProgress?.(`Leaguepedia에서 수상 데이터 조회 중...`);

  const rows = await cargoQuery(
    {
      tables: "TournamentResults=TR,Tournaments=T",
      join_on: "TR.OverviewPage=T.OverviewPage",
      fields: "TR.OverviewPage,TR.Place,TR.Team,T.Name,T.Year,T.League",
      where: `T.League IN ("${leagues}") AND (TR.Place="1" OR TR.Place="2") AND T.Year>=${fromYear}`,
      order_by: "T.Year DESC,T.Name ASC",
    },
    onRetry,
  );

  summary.fetched = rows.length;
  onProgress?.(`${rows.length}개 결과 수신`);
  await sleep(REQUEST_DELAY_MS);

  // 4. 각 결과 처리
  for (const row of rows) {
    const leagueName = row["League"]?.trim();
    const teamName = row["Team"]?.trim();
    const place = row["Place"]?.trim();
    const year = parseInt(row["Year"] ?? "0", 10);
    const tournamentName = row["Name"]?.trim() ?? "";
    const overviewPage = row["OverviewPage"]?.trim() ?? "";

    if (!leagueName || !teamName || !place || !year) continue;

    const awardMap = LEAGUE_TO_AWARD[leagueName];
    if (!awardMap) continue;

    const awardType = place === "1" ? awardMap.champion : awardMap.runnerUp;
    const slug = TEAM_NAME_TO_SLUG[teamName];

    if (!slug) {
      summary.skipped.push({ tournament: tournamentName, team: teamName, place, reason: "team_not_mapped" });
      continue;
    }

    const team = teamBySlug.get(slug);
    if (!team) {
      summary.skipped.push({ tournament: tournamentName, team: teamName, place, reason: "team_not_in_db" });
      continue;
    }

    const key = `${team.id}::${year}::${awardType}::${tournamentName}`;
    if (existingSet.has(key)) {
      onProgress?.(`SKIP ${year} ${tournamentName} ${place}위 ${teamName}`);
      continue;
    }

    const { error } = await supabase.from("team_awards").insert({
      team_id: team.id,
      year,
      tournament_name: tournamentName,
      award_type: awardType,
      leaguepedia_page: overviewPage,
      source: "leaguepedia",
    });

    if (error) {
      summary.skipped.push({ tournament: tournamentName, team: teamName, place, reason: error.message });
      continue;
    }

    onProgress?.(`INSERT ${year} ${tournamentName} ${place}위 → ${team.name} (${awardType})`);
    summary.inserted++;
  }

  return summary;
}
