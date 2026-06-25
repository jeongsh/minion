import type { SupabaseClient } from "@supabase/supabase-js";

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 3_000;
const RATE_LIMIT_BASE_MS = 30_000; // rate limit 발생 시 첫 대기 30초, 이후 선형 증가
const MAX_RETRIES = 12;

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

type ScoreboardRow = {
  Link: string;
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

function parseTournamentPage(overviewPage: string): { year: number; split: string } | null {
  const yearMatch = overviewPage.match(/(\d{4})/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);

  const lower = overviewPage.toLowerCase();
  if (/spring|split.?1/i.test(lower)) return { year, split: "Spring" };
  if (/summer|split.?2/i.test(lower)) return { year, split: "Summer" };

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

async function cargoQuery(params: Record<string, string>, offset = 0): Promise<ScoreboardRow[]> {
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
      cargoquery?: Array<{ title: ScoreboardRow }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      const waitMs = RATE_LIMIT_BASE_MS * (attempt + 1); // 30s, 60s, 90s, ...
      console.warn(`[rate-limit] Retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(waitMs / 1000)}s...`);
      await sleep(waitMs);
      continue;
    }

    if (body.error?.code === "internal_api_error_MWException") {
      if (attempt >= 2) throw new Error(`Cargo error [${body.error.code}]: ${body.error.info}`);
      const waitMs = RATE_LIMIT_BASE_MS;
      console.warn(`[mw-exception] Retry ${attempt + 1}/3 in ${Math.round(waitMs / 1000)}s...`);
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

// LCK ScoreboardPlayers 전체를 한 번에 페이지네이션으로 조회
async function fetchAllLckScoreboardData(
  onProgress?: (message: string) => void,
): Promise<Map<string, ScoreboardRow[]>> {
  const byLink = new Map<string, ScoreboardRow[]>();
  let offset = 0;
  let totalFetched = 0;

  while (true) {
    onProgress?.(`ScoreboardPlayers 조회 중... (offset=${offset})`);

    const batch = await cargoQuery(
      {
        tables: "ScoreboardPlayers=SP",
        fields: "SP.Link,SP.Team,SP.Role,SP.OverviewPage",
        where: 'SP.OverviewPage LIKE "LCK%"',
        group_by: "SP.Link,SP.OverviewPage,SP.Team,SP.Role",
        order_by: "SP.Link ASC,SP.OverviewPage ASC",
      },
      offset,
    );

    for (const row of batch) {
      const link = row.Link?.trim();
      if (!link) continue;
      if (!byLink.has(link)) byLink.set(link, []);
      byLink.get(link)!.push(row);
    }

    totalFetched += batch.length;

    if (batch.length < 500) break;

    offset += 500;
    await sleep(REQUEST_DELAY_MS);
  }

  onProgress?.(`총 ${totalFetched}개 레코드 조회 완료 (${byLink.size}명)`);
  return byLink;
}

function mergeIntoCareerEntries(
  rows: ScoreboardRow[],
  playerPosition: string,
  bySlug: Map<string, TeamRecord>,
) {
  type Entry = {
    teamId: string | null;
    teamName: string | null;
    position: string;
    startDate: string;
    endDate: string;
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
      current = { teamId, teamName, position, startDate: start, endDate: end };
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
  options: {
    skipExisting?: boolean;
    onProgress?: (message: string) => void;
  } = { skipExisting: true },
): Promise<CareerSyncSummary> {
  const { skipExisting = true, onProgress } = options;

  const summary: CareerSyncSummary = {
    playersProcessed: 0,
    playersSkipped: 0,
    recordsInserted: 0,
    errors: [],
  };

  // 팀 목록
  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("id, slug, name")
    .eq("is_lck_team", true);
  if (teamsError) throw teamsError;

  const teams = teamsData as TeamRecord[];
  const bySlug = new Map(teams.map((t) => [t.slug, t]));
  const lckTeamIds = new Set(teams.map((t) => t.id));

  // 선수 목록
  const { data: playersData, error: playersError } = await supabase
    .from("players")
    .select("id, name, position, leaguepedia_page, team_id")
    .not("leaguepedia_page", "is", null);
  if (playersError) throw playersError;

  const players = (playersData as (PlayerRecord & { team_id: string })[]).filter((p) =>
    lckTeamIds.has(p.team_id),
  );

  // 이미 경력 데이터가 있는 선수 ID 수집
  let existingPlayerIds = new Set<string>();
  if (skipExisting) {
    const { data: existingData } = await supabase
      .from("player_career_history")
      .select("player_id");
    existingPlayerIds = new Set(existingData?.map((e: any) => e.player_id) ?? []);
  }

  const playersToProcess = skipExisting
    ? players.filter((p) => !existingPlayerIds.has(p.id))
    : players;

  if (playersToProcess.length === 0) {
    onProgress?.("모든 선수 경력 데이터가 이미 존재합니다.");
    summary.playersSkipped = players.length;
    return summary;
  }

  onProgress?.(
    `처리 대상: ${playersToProcess.length}명 (스킵: ${players.length - playersToProcess.length}명)`,
  );
  summary.playersSkipped = players.length - playersToProcess.length;

  // Leaguepedia 전체 LCK ScoreboardPlayers를 한 번에 조회
  const scoreboardByLink = await fetchAllLckScoreboardData(onProgress);

  // 처리 대상 leaguepedia_page Set
  const targetLinks = new Set(playersToProcess.map((p) => p.leaguepedia_page));

  // 선수별 경력 데이터 처리
  for (const player of playersToProcess) {
    const rows = scoreboardByLink.get(player.leaguepedia_page) ?? [];

    if (rows.length === 0) {
      onProgress?.(`[skip] ${player.name} - Leaguepedia LCK 이력 없음`);
      summary.playersProcessed++;
      continue;
    }

    const entries = mergeIntoCareerEntries(rows, player.position, bySlug);

    const toInsert = entries.map((e) => ({
      player_id: player.id,
      team_id: e.teamId,
      team_name: e.teamName,
      position: e.position,
      start_date: e.startDate,
      end_date: e.endDate,
      notes: null,
    }));

    if (toInsert.length === 0) {
      summary.playersProcessed++;
      continue;
    }

    const { error: insertError, count: inserted } = await supabase
      .from("player_career_history")
      .insert(toInsert, { count: "exact" });

    if (insertError) {
      summary.errors.push({ player: player.name, reason: insertError.message });
    } else {
      const count = inserted ?? toInsert.length;
      summary.recordsInserted += count;
      onProgress?.(`[done] ${player.name} → ${count}개 경력 저장`);
    }

    summary.playersProcessed++;
  }

  return summary;
}
