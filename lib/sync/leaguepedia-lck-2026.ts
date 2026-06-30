import type { SupabaseClient } from "@supabase/supabase-js";

import { SEASON_2026_TOURNAMENTS, type SeasonTournamentConfig } from "../tournaments/season-2026.ts";

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 8;

export type LeaguepediaSyncMode = "incremental" | "full";

export type LeaguepediaSyncSummary = {
  mode: LeaguepediaSyncMode;
  cursor: string | null;
  tournaments: number;
  stages: number;
  matchesFetched: number;
  matchesCreated: number;
  matchesUpdated: number;
  skipped: Array<{
    matchId?: string;
    teamAName?: string;
    teamBName?: string;
    reason: string;
  }>;
};

type TeamRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  leaguepedia_page: string | null;
};

type CargoMatchRow = {
  MatchId: string;
  MatchDateTime: string;
  Team1: string;
  Team2: string;
  Team1Score?: string;
  Team2Score?: string;
  Winner?: string;
  BestOf?: string;
  Tab?: string;
  Round?: string;
  ShownName?: string;
  OverviewPage?: string;
  FF?: string;
};

const TEAM_ALIASES = new Map([
  ["t1", "t1"],
  ["gen.g", "geng"],
  ["gen", "geng"],
  ["geng", "geng"],
  ["hanwha life esports", "hle"],
  ["hle", "hle"],
  ["dplus kia", "dk"],
  ["dk", "dk"],
  ["kt rolster", "kt"],
  ["kt", "kt"],
  ["nongshim redforce", "ns"],
  ["ns", "ns"],
  ["kiwoom drx", "drx"],
  ["drx", "drx"],
  ["hanjin brion", "bro"],
  ["oksavingsbank brion", "bro"],
  ["ok brion", "bro"],
  ["brion", "bro"],
  ["bro", "bro"],
  ["bnk fearx", "fox"],
  ["bfx", "fox"],
  // 2025: Kwangdong → DN Freecs → later DN Soopers
  ["dn freecs", "soop"],
  ["kwangdong freecs", "soop"],
  ["dn soopers", "soop"],
  ["dns", "soop"],
  ["soop", "soop"],
]);

function sleep(ms: number) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function normalizeTeamName(value: string | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeLookupKey(value: string | undefined | null) {
  return normalizeTeamName(value ?? "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[_\s]+/g, " ");
}

function teamSlugFor(name: string) {
  return TEAM_ALIASES.get(normalizeTeamName(name));
}

function parseInteger(value: string | undefined | null) {
  if (value === "" || value == null) {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function stageNameFromRow(row: CargoMatchRow) {
  const parts = [row.Tab, row.Round].filter((part) => part && part.trim());
  return parts.length > 0 ? parts.join(" - ") : "Main";
}

function statusFromRow(row: CargoMatchRow) {
  const scoreA = parseInteger(row.Team1Score);
  const scoreB = parseInteger(row.Team2Score);
  const winner = parseInteger(row.Winner);
  const forfeited = row.FF === "1";

  if (forfeited || winner === 1 || winner === 2) {
    return "completed";
  }
  if (Number.isFinite(scoreA) && Number.isFinite(scoreB)) {
    return "completed";
  }
  return "scheduled";
}

function winnerTeamIdFromRow(row: CargoMatchRow, teamA: TeamRow, teamB: TeamRow) {
  const winner = parseInteger(row.Winner);
  if (winner === 1) {
    return teamA.id;
  }
  if (winner === 2) {
    return teamB.id;
  }

  const scoreA = parseInteger(row.Team1Score);
  const scoreB = parseInteger(row.Team2Score);
  if (scoreA == null || scoreB == null) {
    return null;
  }
  if (scoreA > scoreB) {
    return teamA.id;
  }
  if (scoreB > scoreA) {
    return teamB.id;
  }
  return null;
}

function parseMatchDate(value: string | undefined) {
  if (!value || !/\d{4}/.test(String(value))) {
    return null;
  }

  // Leaguepedia DateTime_UTC는 UTC 기준이지만 timezone suffix 없음 → 명시적으로 Z 추가
  const normalized = value.trim().replace(" ", "T");
  const withZ = /[+Z]/i.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZ);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function matchDateFromRow(row: CargoMatchRow) {
  return parseMatchDate(row.MatchDateTime);
}

function matchDayKST(isoDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate));
}

function formatCargoDateTime(isoDate: string) {
  const date = new Date(isoDate);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function buildWhereClause(overviewPage: string, cursorIso: string | null, mode: LeaguepediaSyncMode) {
  const base = `MS.OverviewPage="${overviewPage}"`;
  if (mode !== "incremental" || !cursorIso) {
    return base;
  }

  return `${base} AND MS.DateTime_UTC > "${formatCargoDateTime(cursorIso)}"`;
}

function isAfterCursor(matchDateIso: string, cursorIso: string | null, mode: LeaguepediaSyncMode) {
  if (mode !== "incremental" || !cursorIso) {
    return true;
  }

  return new Date(matchDateIso).getTime() > new Date(cursorIso).getTime();
}

async function cargoQuery(
  query: Record<string, string>,
  offset = 0,
  onRetry?: (waitMs: number) => void,
) {
  const params = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    limit: "500",
    offset: String(offset),
  });

  for (const [key, value] of Object.entries(query)) {
    params.set(key, value);
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const response = await fetch(`${CARGO_API}?${params.toString()}`, {
      headers: {
        "user-agent": "LCKHubMinion/0.1 (Leaguepedia sync; contact: local-dev)",
      },
    });

    if (!response.ok) {
      throw new Error(`Leaguepedia fetch failed: ${response.status}`);
    }

    const body = (await response.json()) as {
      cargoquery?: Array<{ title: CargoMatchRow }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      const waitMs = REQUEST_DELAY_MS * (attempt + 2);
      onRetry?.(waitMs);
      await sleep(waitMs);
      continue;
    }

    if (body.error) {
      throw new Error(
        `Leaguepedia cargo error (${query.where ?? "no where"}): ${body.error.info ?? body.error.code}`,
      );
    }

    return (body.cargoquery ?? []).map((entry) => entry.title);
  }

  throw new Error("Leaguepedia rate limit retries exhausted.");
}

async function fetchTournamentMatches(
  overviewPage: string,
  cursorIso: string | null,
  mode: LeaguepediaSyncMode,
  onRetry?: (waitMs: number) => void,
) {
  const rows: CargoMatchRow[] = [];
  let offset = 0;
  const where = buildWhereClause(overviewPage, cursorIso, mode);

  while (true) {
    const batch = await cargoQuery(
      {
        tables: "MatchSchedule=MS",
        fields:
          "MS.MatchId,MS.DateTime_UTC=MatchDateTime,MS.Team1,MS.Team2,MS.Team1Score,MS.Team2Score,MS.Winner,MS.BestOf,MS.Tab,MS.Round,MS.ShownName,MS.OverviewPage,MS.FF",
        where,
        order_by: "MS.DateTime_UTC",
        order_by_options: "ASC",
      },
      offset,
      onRetry,
    );

    rows.push(...batch);
    if (batch.length < 500) {
      break;
    }

    offset += 500;
    await sleep(REQUEST_DELAY_MS);
  }

  return rows;
}

async function getRequiredTeams(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("teams")
    .select("id, slug, name, short_name, leaguepedia_page");

  if (error) {
    throw error;
  }

  const bySlug = new Map(data.map((team) => [team.slug, team]));
  const byLeaguepediaPage = new Map<string, TeamRow>();
  for (const team of data) {
    for (const key of [team.leaguepedia_page, team.name, team.short_name]) {
      const normalized = normalizeLookupKey(key);
      if (normalized) {
        byLeaguepediaPage.set(normalized, team);
      }
    }
  }

  return { bySlug, byLeaguepediaPage };
}

function resolveTeam(name: string, teams: Awaited<ReturnType<typeof getRequiredTeams>>) {
  const slug = teamSlugFor(name);
  if (slug) {
    return teams.bySlug.get(slug) ?? null;
  }

  const pageKey = normalizeLookupKey(name);
  return teams.byLeaguepediaPage.get(pageKey) ?? null;
}

export async function getLastCompletedMatchCursor(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("matches")
    .select("match_date")
    .eq("status", "completed")
    .order("match_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.match_date ?? null;
}

async function findOrCreateTournament(supabase: SupabaseClient, tournament: SeasonTournamentConfig) {
  const { data: existing, error: selectError } = await supabase
    .from("tournaments")
    .select("id")
    .eq("source", "leaguepedia")
    .eq("source_tournament_id", tournament.overviewPage)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  const payload = {
    name: tournament.name,
    season: tournament.season,
    category: tournament.category,
    region: tournament.region,
    league: tournament.league,
    split: tournament.split,
    start_date: tournament.startDate,
    end_date: tournament.endDate,
    source: "leaguepedia",
    source_tournament_id: tournament.overviewPage,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("tournaments")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) {
      throw error;
    }
    return data.id;
  }

  const { data, error } = await supabase
    .from("tournaments")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw error;
  }
  return data.id;
}

async function findOrCreateStage(
  supabase: SupabaseClient,
  tournamentId: string,
  stageName: string,
  index: number,
) {
  const { data: existing, error: selectError } = await supabase
    .from("stages")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("name", stageName)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    const { error } = await supabase
      .from("stages")
      .update({ order_index: index })
      .eq("id", existing.id);

    if (error) {
      throw error;
    }
    return existing.id;
  }

  const { data, error } = await supabase
    .from("stages")
    .insert({
      tournament_id: tournamentId,
      name: stageName,
      order_index: index,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }
  return data.id;
}

async function findExistingMatchId(
  supabase: SupabaseClient,
  payload: {
    tournament_id: string;
    team_a_id: string | null;
    team_b_id: string | null;
    match_date: string;
    leaguepedia_match_id: string;
  },
) {
  const { data: byLeaguepediaId, error: byIdError } = await supabase
    .from("matches")
    .select("id")
    .eq("leaguepedia_match_id", payload.leaguepedia_match_id)
    .maybeSingle();

  if (byIdError) {
    throw byIdError;
  }
  if (byLeaguepediaId) {
    return byLeaguepediaId.id;
  }

  // 레거시(gol:%) 매칭은 양 팀이 모두 확정된 경우에만 가능
  if (!payload.team_a_id || !payload.team_b_id) {
    return null;
  }

  const day = matchDayKST(payload.match_date);
  const dayStart = `${day}T00:00:00+09:00`;
  const dayEnd = `${day}T23:59:59+09:00`;

  const { data: legacyRows, error: legacyError } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, leaguepedia_match_id")
    .gte("match_date", dayStart)
    .lte("match_date", dayEnd)
    .or(
      `and(team_a_id.eq.${payload.team_a_id},team_b_id.eq.${payload.team_b_id}),and(team_a_id.eq.${payload.team_b_id},team_b_id.eq.${payload.team_a_id})`,
    )
    .like("leaguepedia_match_id", "gol:%");

  if (legacyError) {
    throw legacyError;
  }

  const legacyMatch = legacyRows?.[0];

  return legacyMatch?.id ?? null;
}

// ─── 국제대회 동기화 ────────────────────────────────────────────

function slugifyTeamName(name: string) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type TeamRowWithLck = TeamRow & { is_lck_team: boolean | null };

async function getTeamsForIntl(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("teams")
    .select("id, slug, name, short_name, leaguepedia_page, is_lck_team");

  if (error) {
    throw error;
  }

  const bySlug = new Map(data.map((t) => [t.slug, t as TeamRowWithLck]));
  const byLeaguepediaPage = new Map<string, TeamRowWithLck>();
  for (const team of data) {
    for (const key of [team.leaguepedia_page, team.name, team.short_name]) {
      const normalized = normalizeLookupKey(key);
      if (normalized) {
        byLeaguepediaPage.set(normalized, team as TeamRowWithLck);
      }
    }
  }

  return { bySlug, byLeaguepediaPage };
}

function resolveTeamIntl(name: string, teams: Awaited<ReturnType<typeof getTeamsForIntl>>) {
  const slug = teamSlugFor(name);
  if (slug) {
    return teams.bySlug.get(slug) ?? null;
  }

  const pageKey = normalizeLookupKey(name);
  return teams.byLeaguepediaPage.get(pageKey) ?? null;
}

async function upsertInternationalTeam(
  supabase: SupabaseClient,
  name: string,
  teams: Awaited<ReturnType<typeof getTeamsForIntl>>,
): Promise<TeamRowWithLck | null> {
  const slug = slugifyTeamName(name);
  if (!slug) {
    return null;
  }

  // 슬러그로 이미 존재하는지 재확인 (캐시 갱신 전에 생성됐을 수 있음)
  const cached = teams.bySlug.get(slug);
  if (cached) {
    return cached;
  }

  const shortName = name.length <= 12 ? name : name.split(/\s+/)[0].substring(0, 20);

  const { data, error } = await supabase
    .from("teams")
    .upsert(
      {
        slug,
        name,
        short_name: shortName,
        primary_color: "#52525B",
        secondary_color: "#18181B",
        fan_site_host: null,
        leaguepedia_page: name,
        source_team_id: `lp:${name}`,
        is_lck_team: false,
        imported_scope: "international_event",
        is_active: true,
      },
      { onConflict: "slug" },
    )
    .select("id, slug, name, short_name, leaguepedia_page, is_lck_team")
    .single();

  if (error) {
    throw error;
  }

  const team = data as TeamRowWithLck;

  // 로컬 캐시 업데이트 (같은 실행 내 중복 upsert 방지)
  teams.bySlug.set(team.slug, team);
  const normalized = normalizeLookupKey(team.leaguepedia_page ?? team.name);
  if (normalized) {
    teams.byLeaguepediaPage.set(normalized, team);
  }

  return team;
}

export type IntlSyncSummary = LeaguepediaSyncSummary & {
  teamsAutoCreated: number;
};

export async function syncInternationalMatches2026(
  supabase: SupabaseClient,
  options: {
    mode?: LeaguepediaSyncMode;
    initialDelayMs?: number;
    onRetry?: (waitMs: number) => void;
    tournaments?: SeasonTournamentConfig[];
  } = {},
): Promise<IntlSyncSummary> {
  const mode = options.mode ?? "incremental";
  const initialDelayMs = options.initialDelayMs ?? 0;
  const onRetry = options.onRetry;
  const allTournaments = options.tournaments ?? SEASON_2026_TOURNAMENTS;

  // 국제대회만 필터링
  const tournamentConfigs = allTournaments.filter((t) => t.category === "international");

  if (initialDelayMs > 0) {
    await sleep(initialDelayMs);
  }

  const cursor = mode === "incremental" ? await getLastCompletedMatchCursor(supabase) : null;
  const teams = await getTeamsForIntl(supabase);

  const summary: IntlSyncSummary = {
    mode,
    cursor,
    tournaments: 0,
    stages: 0,
    matchesFetched: 0,
    matchesCreated: 0,
    matchesUpdated: 0,
    teamsAutoCreated: 0,
    skipped: [],
  };

  for (const tournament of tournamentConfigs) {
    const tournamentId = await findOrCreateTournament(supabase, tournament);
    summary.tournaments += 1;

    let rows: CargoMatchRow[];
    try {
      rows = await fetchTournamentMatches(tournament.overviewPage, cursor, mode, onRetry);
    } catch (err) {
      summary.skipped.push({
        reason: `leaguepedia_fetch_error:${tournament.overviewPage}:${(err as Error).message}`,
      });
      await sleep(REQUEST_DELAY_MS);
      continue;
    }
    summary.matchesFetched += rows.length;

    const stageOrder = new Map<string, number>();
    const seenStages = new Set<string>();

    for (const row of rows) {
      const teamAName = row.Team1?.trim();
      const teamBName = row.Team2?.trim();

      // 팀이 아직 미정(TBD)이면 팀 없이 일정만 저장한다
      const teamAIsTbd = !teamAName || teamAName === "TBD";
      const teamBIsTbd = !teamBName || teamBName === "TBD";

      let teamA = teamAIsTbd ? null : resolveTeamIntl(teamAName, teams);
      let teamB = teamBIsTbd ? null : resolveTeamIntl(teamBName, teams);

      // 미등록 팀 자동 생성 (실팀일 때만)
      if (!teamAIsTbd && !teamA) {
        teamA = await upsertInternationalTeam(supabase, teamAName, teams);
        if (teamA) {
          summary.teamsAutoCreated += 1;
        }
      }

      if (!teamBIsTbd && !teamB) {
        teamB = await upsertInternationalTeam(supabase, teamBName, teams);
        if (teamB) {
          summary.teamsAutoCreated += 1;
        }
      }

      // 실팀인데 생성에 실패한 경우만 스킵 (TBD는 통과)
      if ((!teamAIsTbd && !teamA) || (!teamBIsTbd && !teamB)) {
        summary.skipped.push({
          matchId: row.MatchId,
          teamAName,
          teamBName,
          reason: "team_create_failed",
        });
        continue;
      }

      const matchDate = matchDateFromRow(row);
      if (!matchDate) {
        summary.skipped.push({
          matchId: row.MatchId,
          teamAName,
          teamBName,
          reason: "invalid_or_missing_match_date",
        });
        continue;
      }

      if (!isAfterCursor(matchDate, cursor, mode)) {
        summary.skipped.push({
          matchId: row.MatchId,
          teamAName,
          teamBName,
          reason: "before_sync_cursor",
        });
        continue;
      }

      const stageName = stageNameFromRow(row);
      if (!stageOrder.has(stageName)) {
        stageOrder.set(stageName, stageOrder.size + 1);
      }

      const stageId = await findOrCreateStage(
        supabase,
        tournamentId,
        stageName,
        stageOrder.get(stageName)!,
      );

      if (!seenStages.has(stageId)) {
        seenStages.add(stageId);
        summary.stages += 1;
      }

      const existingId = await findExistingMatchId(supabase, {
        tournament_id: tournamentId,
        team_a_id: teamA?.id ?? null,
        team_b_id: teamB?.id ?? null,
        match_date: matchDate,
        leaguepedia_match_id: row.MatchId,
      });

      const payload = {
        tournament_id: tournamentId,
        stage_id: stageId,
        name:
          row.ShownName?.trim() ||
          `${teamA?.short_name ?? "TBD"} vs ${teamB?.short_name ?? "TBD"}`,
        match_date: matchDate,
        status: statusFromRow(row),
        team_a_id: teamA?.id ?? null,
        team_b_id: teamB?.id ?? null,
        team_a_score: parseInteger(row.Team1Score),
        team_b_score: parseInteger(row.Team2Score),
        best_of: parseInteger(row.BestOf),
        winner_team_id: teamA && teamB ? winnerTeamIdFromRow(row, teamA, teamB) : null,
        leaguepedia_match_id: row.MatchId,
        venue: null,
        vod_url: null,
      };

      if (existingId) {
        const { error } = await supabase.from("matches").update(payload).eq("id", existingId);
        if (error) {
          throw error;
        }
        summary.matchesUpdated += 1;
        continue;
      }

      const { error } = await supabase.from("matches").insert(payload);
      if (error) {
        throw error;
      }
      summary.matchesCreated += 1;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return summary;
}

// ─── LCK 동기화 ─────────────────────────────────────────────────

export async function syncLeaguepediaLck2026(
  supabase: SupabaseClient,
  options: {
    mode?: LeaguepediaSyncMode;
    initialDelayMs?: number;
    onRetry?: (waitMs: number) => void;
    tournaments?: SeasonTournamentConfig[];
  } = {},
): Promise<LeaguepediaSyncSummary> {
  const mode = options.mode ?? "incremental";
  const initialDelayMs = options.initialDelayMs ?? 0;
  const onRetry = options.onRetry;
  const tournamentConfigs = options.tournaments ?? SEASON_2026_TOURNAMENTS;

  if (initialDelayMs > 0) {
    await sleep(initialDelayMs);
  }

  const cursor = mode === "incremental" ? await getLastCompletedMatchCursor(supabase) : null;

  const teams = await getRequiredTeams(supabase);
  const summary: LeaguepediaSyncSummary = {
    mode,
    cursor,
    tournaments: 0,
    stages: 0,
    matchesFetched: 0,
    matchesCreated: 0,
    matchesUpdated: 0,
    skipped: [],
  };

  for (const tournament of tournamentConfigs) {
    const tournamentId = await findOrCreateTournament(supabase, tournament);
    summary.tournaments += 1;

    let rows: CargoMatchRow[];
    try {
      rows = await fetchTournamentMatches(tournament.overviewPage, cursor, mode, onRetry);
    } catch (err) {
      summary.skipped.push({
        reason: `leaguepedia_fetch_error:${tournament.overviewPage}:${(err as Error).message}`,
      });
      await sleep(REQUEST_DELAY_MS);
      continue;
    }
    summary.matchesFetched += rows.length;

    const stageOrder = new Map<string, number>();
    const seenStages = new Set<string>();

    for (const row of rows) {
      const teamAName = row.Team1?.trim();
      const teamBName = row.Team2?.trim();

      // 팀이 아직 미정(TBD)이면 팀 없이 일정만 저장한다
      const teamAIsTbd = !teamAName || teamAName === "TBD";
      const teamBIsTbd = !teamBName || teamBName === "TBD";

      const teamA = teamAIsTbd ? null : resolveTeam(teamAName, teams);
      const teamB = teamBIsTbd ? null : resolveTeam(teamBName, teams);

      // 실팀인데 별칭을 못 찾은 경우만 스킵 (TBD는 통과)
      if ((!teamAIsTbd && !teamA) || (!teamBIsTbd && !teamB)) {
        summary.skipped.push({
          matchId: row.MatchId,
          teamAName,
          teamBName,
          reason: "team_alias_not_found",
        });
        continue;
      }

      const matchDate = matchDateFromRow(row);
      if (!matchDate) {
        summary.skipped.push({
          matchId: row.MatchId,
          teamAName,
          teamBName,
          reason: "invalid_or_missing_match_date",
        });
        continue;
      }

      if (!isAfterCursor(matchDate, cursor, mode)) {
        summary.skipped.push({
          matchId: row.MatchId,
          teamAName,
          teamBName,
          reason: "before_sync_cursor",
        });
        continue;
      }

      const stageName = stageNameFromRow(row);
      if (!stageOrder.has(stageName)) {
        stageOrder.set(stageName, stageOrder.size + 1);
      }

      const stageId = await findOrCreateStage(
        supabase,
        tournamentId,
        stageName,
        stageOrder.get(stageName)!,
      );

      if (!seenStages.has(stageId)) {
        seenStages.add(stageId);
        summary.stages += 1;
      }

      const existingId = await findExistingMatchId(supabase, {
        tournament_id: tournamentId,
        team_a_id: teamA?.id ?? null,
        team_b_id: teamB?.id ?? null,
        match_date: matchDate,
        leaguepedia_match_id: row.MatchId,
      });

      const payload = {
        tournament_id: tournamentId,
        stage_id: stageId,
        name:
          row.ShownName?.trim() ||
          `${teamA?.short_name ?? "TBD"} vs ${teamB?.short_name ?? "TBD"}`,
        match_date: matchDate,
        status: statusFromRow(row),
        team_a_id: teamA?.id ?? null,
        team_b_id: teamB?.id ?? null,
        team_a_score: parseInteger(row.Team1Score),
        team_b_score: parseInteger(row.Team2Score),
        best_of: parseInteger(row.BestOf),
        winner_team_id: teamA && teamB ? winnerTeamIdFromRow(row, teamA, teamB) : null,
        leaguepedia_match_id: row.MatchId,
        venue: null,
        vod_url: null,
      };

      if (existingId) {
        const { error } = await supabase.from("matches").update(payload).eq("id", existingId);
        if (error) {
          throw error;
        }
        summary.matchesUpdated += 1;
        continue;
      }

      const { error } = await supabase.from("matches").insert(payload);
      if (error) {
        throw error;
      }
      summary.matchesCreated += 1;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return summary;
}
