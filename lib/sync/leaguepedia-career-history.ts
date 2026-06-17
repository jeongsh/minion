import type { SupabaseClient } from "@supabase/supabase-js";

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 4000;
const MAX_RETRIES = 8;

// LCK team IDs in our DB (slug → id resolved at runtime)
const LCK_SLUGS = new Set(["hle", "geng", "t1", "dk", "kt", "bro", "fox", "ns", "drx", "soop"]);

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

type HistoryRow = {
  Player: string;
  Team: string;
  League: string;
  Year: string;
  Split: string;
  Role: string;
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

// year + split 을 날짜 범위로 변환
function splitToDateRange(year: number, split: string): { start: string; end: string } {
  const s = split.toLowerCase();
  if (s.includes("spring") || s === "1") {
    return { start: `${year}-01-01`, end: `${year}-05-31` };
  }
  if (s.includes("summer") || s === "2") {
    return { start: `${year}-06-01`, end: `${year}-11-30` };
  }
  // fallback: treat as full year
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

async function cargoQuery(params: Record<string, string>, offset = 0): Promise<HistoryRow[]> {
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
      cargoquery?: Array<{ title: HistoryRow }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      const waitMs = REQUEST_DELAY_MS * (attempt + 2);
      console.warn(`[rate-limit] Retry ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms...`);
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

async function fetchPlayerHistory(leaguepediaPage: string): Promise<HistoryRow[]> {
  const rows: HistoryRow[] = [];
  let offset = 0;

  while (true) {
    const batch = await cargoQuery(
      {
        tables: "PlayerLeagueHistory=PLH",
        fields: "PLH.Player,PLH.Team,PLH.League,PLH.Year,PLH.Split,PLH.Role",
        where: `PLH.Player="${leaguepediaPage.replace(/"/g, '\\"')}"`,
        order_by: "PLH.Year, PLH.Split",
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

// 연속된 같은 팀 스플릿을 하나의 경력 record로 병합
function mergeIntoCareerEntries(
  rows: HistoryRow[],
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
    const year = parseInt(row.Year ?? "0", 10);
    if (!year) continue;

    const { start, end } = splitToDateRange(year, row.Split ?? "");
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
      // same team → extend the end date
      current.endDate = end;
    } else {
      if (current) entries.push(current);
      current = { teamId, teamName, position, startDate: start, endDate: end, league: row.League ?? "" };
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

  // DB에서 LCK 팀 ID 목록 로드
  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("id, slug, name")
    .eq("is_lck_team", true);
  if (teamsError) throw teamsError;

  const teams = teamsData as TeamRecord[];
  const bySlug = new Map(teams.map((t) => [t.slug, t]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const lckTeamIds = new Set(teams.map((t) => t.id));

  // DB에서 leaguepedia_page가 있는 LCK 선수 목록 로드
  const { data: playersData, error: playersError } = await supabase
    .from("players")
    .select("id, name, position, leaguepedia_page, team_id")
    .not("leaguepedia_page", "is", null);
  if (playersError) throw playersError;

  const players = (playersData as PlayerRecord[]).filter((p) =>
    lckTeamIds.has((p as any).team_id),
  );

  // 이미 경력 이력이 있는 선수 ID 세트
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

    let rows: HistoryRow[];
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
      console.log(`  → 결과 없음 (Leaguepedia에 이력 없음)`);
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
      notes: e.league && e.league !== "LCK" ? `${e.league} 활동` : null,
    }));

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("player_career_history")
        .insert(toInsert);

      if (insertError) {
        summary.errors.push({ player: player.name, reason: insertError.message });
      } else {
        summary.recordsInserted += toInsert.length;
        console.log(`  → ${toInsert.length}개 경력 저장`);
      }
    }

    summary.playersProcessed++;
  }

  return summary;
}
