import type { SupabaseClient } from "@supabase/supabase-js";

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 4000;
const MAX_RETRIES = 8;

const TEAM_ALIASES = new Map([
  ["t1", "t1"],
  ["skt t1", "t1"],
  ["sk telecom t1", "t1"],
  ["gen.g", "geng"],
  ["gen", "geng"],
  ["geng", "geng"],
  ["samsung galaxy", "geng"],
  ["ksv esports", "geng"],
  ["hanwha life esports", "hle"],
  ["hle", "hle"],
  ["dplus kia", "dk"],
  ["damwon kia", "dk"],
  ["damwon gaming", "dk"],
  ["dwg", "dk"],
  ["dk", "dk"],
  ["kt rolster", "kt"],
  ["kt", "kt"],
  ["nongshim redforce", "ns"],
  ["nongshim", "ns"],
  ["ns", "ns"],
  ["kiwoom drx", "drx"],
  ["drx", "drx"],
  ["dragonx", "drx"],
  ["dragon x", "drx"],
  ["hanjin brion", "bro"],
  ["brion", "bro"],
  ["bro", "bro"],
  ["bnk fearx", "fox"],
  ["fearx", "fox"],
  ["bfx", "fox"],
  ["dn soopers", "soop"],
  ["dn freecs", "soop"],
  ["dn suprs", "soop"],
  ["soop", "soop"],
]);

const POSITION_MAP: Record<string, string> = {
  top: "TOP",
  jungle: "JGL",
  jgl: "JGL",
  jungler: "JGL",
  mid: "MID",
  middle: "MID",
  adc: "BOT",
  bot: "BOT",
  bottom: "BOT",
  support: "SUP",
  sup: "SUP",
};

type TournamentRow = {
  Team: string;
  Role: string;
  OverviewPage: string;
};

type PlayerRecord = {
  id: string;
  name: string;
  position: string;
  leaguepedia_page: string;
};

type TeamRecord = {
  id: string;
  slug: string;
  name: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTeam(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugFor(name: string) {
  return TEAM_ALIASES.get(normalizeTeam(name)) ?? null;
}

function normalizePosition(role: string, fallback: string): string {
  const mapped = POSITION_MAP[role.trim().toLowerCase()];
  return mapped ?? fallback;
}

function escapeCargoValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// OverviewPage 예시:
//   "LCK/2024 Season/Spring Season"
//   "LCK/2024 Season/Summer Season"
//   "LCK 2025 Split 1"
//   "LCK 2026 Split 2"
function parseTournamentPage(overviewPage: string): { year: number; split: string } | null {
  const yearMatch = overviewPage.match(/(\d{4})/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);

  const lower = overviewPage.toLowerCase();
  if (/spring|split.?1/i.test(lower)) return { year, split: "Spring" };
  if (/summer|split.?2/i.test(lower)) return { year, split: "Summer" };

  // playoffs/regional finals 등 → split 추정 불가, 해당 연도 내 마지막 split으로 처리
  if (lower.includes("regional") || lower.includes("playoff") || lower.includes("final")) {
    return { year, split: "Summer" };
  }

  return { year, split: "" };
}

function splitToDateRange(year: number, split: string): { start: string; end: string } {
  const s = split.toLowerCase();
  if (s === "spring") return { start: `${year}-01-01`, end: `${year}-05-31` };
  if (s === "summer") return { start: `${year}-06-01`, end: `${year}-11-30` };
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

async function cargoQuery(params: Record<string, string>, offset = 0): Promise<TournamentRow[]> {
  const searchParams = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    limit: "500",
    offset: String(offset),
    ...params,
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(`${CARGO_API}?${searchParams}`, {
      headers: { "user-agent": "LCKHubMinion/0.1 (career-history sync)" },
    });

    if (!res.ok) throw new Error(`Leaguepedia fetch failed: ${res.status}`);

    const body = (await res.json()) as {
      cargoquery?: Array<{ title: TournamentRow }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      const waitMs = REQUEST_DELAY_MS * (attempt + 2);
      console.warn(`[rate-limit] Retry ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms...`);
      await sleep(waitMs);
      continue;
    }

    if (body.error?.code === "internal_api_error_MWException") {
      if (attempt >= 2) throw new Error(`Cargo error [${body.error.code}]: ${body.error.info}`);
      const waitMs = REQUEST_DELAY_MS * 2;
      console.warn(`[mw-exception] Retry ${attempt + 1}/3 in ${waitMs}ms...`);
      await sleep(waitMs);
      continue;
    }

    if (body.error) {
      throw new Error(`Cargo error [${body.error.code}]: ${body.error.info}`);
    }

    return (body.cargoquery ?? []).map((e) => e.title);
  }

  throw new Error("Rate limit retries exhausted.");
}

async function fetchPlayerHistory(leaguepediaPage: string): Promise<TournamentRow[]> {
  const rows: TournamentRow[] = [];
  let offset = 0;

  while (true) {
    const batch = await cargoQuery(
      {
        tables: "ScoreboardPlayers=SP",
        fields: "SP.Team,SP.Role,SP.OverviewPage",
        where: `SP.Link="${escapeCargoValue(leaguepediaPage)}" AND SP.OverviewPage LIKE "LCK%"`,
        group_by: "SP.OverviewPage,SP.Team,SP.Role",
        order_by: "SP.OverviewPage ASC",
      },
      offset,
    );

    rows.push(...batch);
    if (batch.length < 500) break;

    offset += 500;
    await sleep(REQUEST_DELAY_MS);
  }

  return rows;
}

function mergeIntoCareerEntries(
  rows: TournamentRow[],
  playerPosition: string,
  teamById: Map<string, TeamRecord>,
  bySlug: Map<string, TeamRecord>,
) {
  type Entry = {
    teamId: string | null;
    teamName: string | null;
    position: string;
    startDate: string;
    endDate: string;
    league: string;
  };

  const entries: Entry[] = [];
  let current: Entry | null = null;

  for (const row of rows) {
    const parsed = parseTournamentPage(row.OverviewPage ?? "");
    if (!parsed || !parsed.year) continue;

    const { year, split } = parsed;
    const { start, end } = splitToDateRange(year, split);
    const position = normalizePosition(row.Role ?? "", playerPosition);
    const teamSlug = slugFor(row.Team ?? "");
    const team = teamSlug ? bySlug.get(teamSlug) ?? null : null;
    const teamId = team?.id ?? null;
    const teamName = team ? null : (row.Team?.trim() ?? null);
    const canonicalTeamKey = teamId ?? teamName ?? "";

    if (
      current &&
      (current.teamId ?? current.teamName ?? "") === canonicalTeamKey &&
      current.position === position
    ) {
      current.endDate = end;
    } else {
      if (current) entries.push(current);
      current = { teamId, teamName, position, startDate: start, endDate: end, league: "LCK" };
    }
  }

  if (current) entries.push(current);

  return entries;
}

export type CareerSyncSummary = {
  playersProcessed: number;
  playersSkipped: number;
  recordsInserted: number;
  errors: Array<{ player: string; reason: string }>;
};

export async function syncCareerHistories(
  supabase: SupabaseClient,
  options: { skipExisting?: boolean } = { skipExisting: true },
): Promise<CareerSyncSummary> {
  const summary: CareerSyncSummary = {
    playersProcessed: 0,
    playersSkipped: 0,
    recordsInserted: 0,
    errors: [],
  };

  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("id, slug, name")
    .eq("is_lck_team", true);
  if (teamsError) throw teamsError;

  const teams = teamsData as TeamRecord[];
  const bySlug = new Map(teams.map((t) => [t.slug, t]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const lckTeamIds = new Set(teams.map((t) => t.id));

  const { data: playersData, error: playersError } = await supabase
    .from("players")
    .select("id, name, position, leaguepedia_page, team_id")
    .not("leaguepedia_page", "is", null);
  if (playersError) throw playersError;

  const players = (playersData as PlayerRecord[]).filter((p) =>
    lckTeamIds.has((p as any).team_id),
  );

  let existingPlayerIds = new Set<string>();
  if (options.skipExisting) {
    const { data: existingData } = await supabase
      .from("player_career_history")
      .select("player_id");
    existingPlayerIds = new Set(existingData?.map((e: any) => e.player_id) ?? []);
  }

  for (const player of players) {
    if (options.skipExisting && existingPlayerIds.has(player.id)) {
      console.log(`[skip] ${player.name} (이미 경력 데이터 있음)`);
      summary.playersSkipped++;
      continue;
    }

    console.log(`[sync] ${player.name} (${player.leaguepedia_page})...`);

    let rows: TournamentRow[];
    try {
      rows = await fetchPlayerHistory(player.leaguepedia_page);
      await sleep(REQUEST_DELAY_MS);
    } catch (err) {
      const reason = (err as Error).message;
      console.error(`[error] ${player.name}: ${reason}`);
      summary.errors.push({ player: player.name, reason });
      continue;
    }

    if (rows.length === 0) {
      console.log(`  → 결과 없음 (Leaguepedia에 LCK 이력 없음)`);
      summary.playersProcessed++;
      continue;
    }

    const entries = mergeIntoCareerEntries(rows, player.position, teamById, bySlug);

    const toInsert = entries.map((e) => ({
      player_id: player.id,
      team_id: e.teamId,
      team_name: e.teamName,
      position: e.position,
      start_date: e.startDate,
      end_date: e.endDate,
      notes: null,
    }));

    if (toInsert.length > 0) {
      const { error: insertError, data: inserted } = await supabase
        .from("player_career_history")
        .upsert(toInsert, {
          onConflict: "player_id,position,start_date",
          ignoreDuplicates: true,
        })
        .select("id");

      if (insertError) {
        summary.errors.push({ player: player.name, reason: insertError.message });
      } else {
        const count = inserted?.length ?? 0;
        const skipped = toInsert.length - count;
        summary.recordsInserted += count;
        console.log(`  → ${count}개 경력 저장${skipped > 0 ? ` (${skipped}개 중복 스킵)` : ""}`);
      }
    }

    summary.playersProcessed++;
  }

  return summary;
}
