import type { SupabaseClient } from "@supabase/supabase-js";

import {
  displayNameFromLeaguepediaPage,
  leaguepediaSourceId,
  normalizeLeaguepediaKey,
} from "../leaguepedia-identity.ts";
import { SEASON_2026_TOURNAMENTS, type SeasonTournamentConfig } from "../tournaments/season-2026.ts";
import { fetchAuthenticatedLeaguepediaApi } from "./leaguepedia-api.ts";

const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 5;

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
  source_team_id?: string | null;
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
  return normalizeLeaguepediaKey(displayNameFromLeaguepediaPage(value));
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

function escapeCargoValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildWhereClause(overviewPages: string[], cursorIso: string | null, mode: LeaguepediaSyncMode) {
  const base = `(${overviewPages
    .map((overviewPage) => `MS.OverviewPage="${escapeCargoValue(overviewPage)}"`)
    .join(" OR ")})`;
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
    const response = await fetchAuthenticatedLeaguepediaApi(params);

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
  overviewPages: string[],
  cursorIso: string | null,
  mode: LeaguepediaSyncMode,
  onRetry?: (waitMs: number) => void,
) {
  const rows: CargoMatchRow[] = [];
  let offset = 0;
  const where = buildWhereClause(overviewPages, cursorIso, mode);

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

function matchesByOverviewPage(rows: CargoMatchRow[]) {
  const grouped = new Map<string, CargoMatchRow[]>();

  for (const row of rows) {
    const overviewPage = row.OverviewPage?.trim();
    if (!overviewPage) continue;
    const existing = grouped.get(overviewPage);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(overviewPage, [row]);
    }
  }

  return grouped;
}

async function getRequiredTeams(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("teams")
    .select("id, slug, name, short_name, leaguepedia_page, source_team_id");

  if (error) {
    throw error;
  }

  const bySlug = new Map(data.map((team) => [team.slug, team]));
  const byLeaguepediaPage = new Map<string, TeamRow>();
  for (const team of data) {
    for (const key of [team.leaguepedia_page, team.source_team_id, team.name, team.short_name]) {
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
  stageKey: string,
  index: number,
) {
  // 매칭은 항상 리그피디아 원본 키(source_stage_key)로 한다. 관리자가 화면에 보이는
  // name을 자유롭게 바꿔도(예: "Quarterfinals" -> "8강") 다음 동기화에서 같은 라운드로
  // 인식되어야 하며, 절대 중복 스테이지를 만들거나 name/bracket_stage_id를 덮어써서는 안 된다.
  const { data: existingByKey, error: selectByKeyError } = await supabase
    .from("stages")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("source_stage_key", stageKey)
    .maybeSingle();

  if (selectByKeyError) {
    throw selectByKeyError;
  }

  if (existingByKey) {
    const { error } = await supabase
      .from("stages")
      .update({ order_index: index })
      .eq("id", existingByKey.id);

    if (error) {
      throw error;
    }
    return existingByKey.id;
  }

  // source_stage_key가 아직 채워지지 않은 레거시 행(이 컬럼 도입 이전에 생성됨)은
  // name으로 한 번만 찾아서 키를 채워준다. 관리자가 이미 이름을 바꿔놓은 행은
  // 여기서도 못 찾겠지만, 그 경우는 새 스테이지 생성이 아니라 수동 데이터 정리로
  // 해결해야 한다 (이름만 보고는 안전하게 매칭할 수 없기 때문).
  const { data: existingByName, error: selectByNameError } = await supabase
    .from("stages")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("name", stageKey)
    .is("source_stage_key", null)
    .maybeSingle();

  if (selectByNameError) {
    throw selectByNameError;
  }

  if (existingByName) {
    const { error } = await supabase
      .from("stages")
      .update({ order_index: index, source_stage_key: stageKey })
      .eq("id", existingByName.id);

    if (error) {
      throw error;
    }
    return existingByName.id;
  }

  const { data: existingBracketStage, error: bracketStageSelectError } = await supabase
    .from("bracket_stages")
    .select("id")
    .eq("tournament_id", tournamentId)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (bracketStageSelectError) {
    throw bracketStageSelectError;
  }

  let bracketStageId = existingBracketStage?.id;
  if (!bracketStageId) {
    const { data: createdBracketStage, error: bracketStageInsertError } = await supabase
      .from("bracket_stages")
      .insert({
        tournament_id: tournamentId,
        name: "메인 브래킷",
        order_index: 0,
      })
      .select("id")
      .single();

    if (bracketStageInsertError) {
      throw bracketStageInsertError;
    }
    bracketStageId = createdBracketStage.id;
  }

  const { data, error } = await supabase
    .from("stages")
    .insert({
      tournament_id: tournamentId,
      bracket_stage_id: bracketStageId,
      name: stageKey,
      source_stage_key: stageKey,
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
    .select("id, slug, name, short_name, leaguepedia_page, source_team_id, is_lck_team");

  if (error) {
    throw error;
  }

  const bySlug = new Map(data.map((t) => [t.slug, t as TeamRowWithLck]));
  const byId = new Map(data.map((t) => [t.id, t as TeamRowWithLck]));
  const byLeaguepediaPage = new Map<string, TeamRowWithLck>();
  for (const team of data) {
    for (const key of [team.leaguepedia_page, team.source_team_id, team.name, team.short_name]) {
      const normalized = normalizeLookupKey(key);
      if (normalized) {
        byLeaguepediaPage.set(normalized, team as TeamRowWithLck);
      }
    }
  }

  // leaguepedia_team_aliases에는 세트별 동기화(syncLeaguepediaMatchSets)가 팀을 찾을 때마다
  // 관찰한 페이지명이 쌓인다(리그피디아가 같은 팀을 여러 페이지명으로 부르는 경우가 있어서,
  // 예: 개명 전/후 페이지, disambiguation 페이지). 이 국제대회 동기화도 같은 별칭을 알아야
  // 이미 등록된 팀을 "새 팀"으로 잘못 판단해 중복 생성하지 않는다.
  const { data: aliasRows, error: aliasError } = await supabase
    .from("leaguepedia_team_aliases")
    .select("team_id, page_name");
  if (aliasError) {
    throw aliasError;
  }
  for (const alias of aliasRows ?? []) {
    const team = byId.get(alias.team_id);
    const normalized = normalizeLookupKey(alias.page_name);
    if (team && normalized && !byLeaguepediaPage.has(normalized)) {
      byLeaguepediaPage.set(normalized, team);
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
  const displayName = displayNameFromLeaguepediaPage(name);
  const slug = slugifyTeamName(displayName);
  if (!slug) {
    return null;
  }

  // 슬러그로 이미 존재하는지 재확인 (캐시 갱신 전에 생성됐을 수 있음)
  const cached = teams.bySlug.get(slug);
  if (cached) {
    return cached;
  }

  const shortName = displayName.length <= 12
    ? displayName
    : displayName.split(/\s+/)[0].substring(0, 20);

  // ignoreDuplicates: 이미 존재하는 팀이면 아무것도 덮어쓰지 않는다(수동 관리하는 팀 색상 보호).
  const { data, error } = await supabase
    .from("teams")
    .upsert(
      {
        slug,
        name: displayName,
        short_name: shortName,
        primary_color: "#52525B",
        secondary_color: "#18181B",
        fan_site_host: null,
        leaguepedia_page: name,
        source_team_id: leaguepediaSourceId(name),
        is_lck_team: false,
        imported_scope: "international_event",
        is_active: true,
      },
      { onConflict: "slug", ignoreDuplicates: true },
    )
    .select("id, slug, name, short_name, leaguepedia_page, source_team_id, is_lck_team")
    .maybeSingle();

  if (error) {
    throw error;
  }

  let team = data as TeamRowWithLck | null;
  if (!team) {
    // 충돌로 insert가 스킵된 경우(캐시에 없던 기존 팀) — 기존 행을 그대로 사용한다.
    const { data: existing, error: existingError } = await supabase
      .from("teams")
      .select("id, slug, name, short_name, leaguepedia_page, source_team_id, is_lck_team")
      .eq("slug", slug)
      .single();
    if (existingError) {
      throw existingError;
    }
    team = existing as TeamRowWithLck;
  }

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

  let fetchedRows: CargoMatchRow[];
  try {
    fetchedRows = await fetchTournamentMatches(
      tournamentConfigs.map((tournament) => tournament.overviewPage),
      cursor,
      mode,
      onRetry,
    );
  } catch (err) {
    summary.skipped.push({
      reason: `leaguepedia_fetch_error:${(err as Error).message}`,
    });
    return summary;
  }
  summary.matchesFetched = fetchedRows.length;
  const rowsByOverviewPage = matchesByOverviewPage(fetchedRows);

  for (const tournament of tournamentConfigs) {
    const tournamentId = await findOrCreateTournament(supabase, tournament);
    summary.tournaments += 1;
    const rows = rowsByOverviewPage.get(tournament.overviewPage) ?? [];

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
        // stage_id는 여기서 다시 덮어쓰지 않는다. 리그피디아 원본은 그룹 스테이지 안의
        // 라운드(1경기/승자전·패자전/최종전 등)를 구분해주지 않아서 매번 같은 키로
        // 계산되는데, 그대로 덮어쓰면 관리자가 브래킷 편집기로 라운드별 컬럼을 나눠둔
        // 결과가 다음 동기화 때마다 하나로 다시 뭉개진다. bracket_side/bracket_order/
        // group_index/advances_to_match_id와 마찬가지로 stage_id도 최초 생성 이후에는
        // 관리자 소유 필드로 취급한다.
        const { stage_id: _stageId, ...updatePayload } = payload;
        const { error } = await supabase.from("matches").update(updatePayload).eq("id", existingId);
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

  let fetchedRows: CargoMatchRow[];
  try {
    fetchedRows = await fetchTournamentMatches(
      tournamentConfigs.map((tournament) => tournament.overviewPage),
      cursor,
      mode,
      onRetry,
    );
  } catch (err) {
    summary.skipped.push({
      reason: `leaguepedia_fetch_error:${(err as Error).message}`,
    });
    return summary;
  }
  summary.matchesFetched = fetchedRows.length;
  const rowsByOverviewPage = matchesByOverviewPage(fetchedRows);

  for (const tournament of tournamentConfigs) {
    const tournamentId = await findOrCreateTournament(supabase, tournament);
    summary.tournaments += 1;
    const rows = rowsByOverviewPage.get(tournament.overviewPage) ?? [];

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
        // stage_id는 여기서 다시 덮어쓰지 않는다. 리그피디아 원본은 그룹 스테이지 안의
        // 라운드(1경기/승자전·패자전/최종전 등)를 구분해주지 않아서 매번 같은 키로
        // 계산되는데, 그대로 덮어쓰면 관리자가 브래킷 편집기로 라운드별 컬럼을 나눠둔
        // 결과가 다음 동기화 때마다 하나로 다시 뭉개진다. bracket_side/bracket_order/
        // group_index/advances_to_match_id와 마찬가지로 stage_id도 최초 생성 이후에는
        // 관리자 소유 필드로 취급한다.
        const { stage_id: _stageId, ...updatePayload } = payload;
        const { error } = await supabase.from("matches").update(updatePayload).eq("id", existingId);
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

  }

  return summary;
}
