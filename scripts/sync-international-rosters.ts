import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { SEASON_2026_TOURNAMENTS } from "../lib/tournaments/season-2026.ts";
import { getLastCompletedMatchCursor } from "../lib/sync/leaguepedia-lck-2026.ts";
import {
  displayNameFromLeaguepediaPage,
  leaguepediaSourceId,
  normalizeLeaguepediaKey,
} from "../lib/leaguepedia-identity.ts";

const CARGO_API = "https://lol.fandom.com/api.php";
const USER_AGENT = "LCKHubMinion/0.1 (international roster sync; contact: local-dev)";

const REQUEST_DELAY_MS = 2000;
const RATE_LIMIT_BASE_MS = 20000;
const MAX_RETRIES = 15;

type LeaguepediaSyncMode = "incremental" | "full";

type PlayerPosition = "TOP" | "JGL" | "MID" | "BOT" | "SUP";

type TeamRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  leaguepedia_page: string | null;
  source_team_id: string | null;
  is_lck_team: boolean;
};

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function loadEnvFile() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=");
    }
  } catch {
    // env vars already set
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function escapeCargoValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeLookupKey(value: string | null | undefined) {
  return normalizeLeaguepediaKey(displayNameFromLeaguepediaPage(value));
}

function slugifyTeamName(name: string) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function makePlayerSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function normalizeRole(role: string | null | undefined): PlayerPosition | null {
  const raw = String(role ?? "").trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (upper === "TOP" || upper === "JGL" || upper === "MID" || upper === "BOT" || upper === "SUP") {
    return upper as PlayerPosition;
  }

  const r = raw.toLowerCase();
  if (r === "top") return "TOP";
  if (r === "jungle" || r === "jgl") return "JGL";
  if (r === "mid" || r === "middle") return "MID";
  if (r === "bot" || r === "bottom" || r === "adc") return "BOT";
  if (r === "support" || r === "sup") return "SUP";
  return null;
}

function parseRosterField(raw: string | null | undefined) {
  if (!raw) return [];
  const sep = raw.includes(",,") ? ",," : ",";
  return raw
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function cargoQuery(
  query: Record<string, string>,
  onRetry?: (waitMs: number) => void,
): Promise<Array<Record<string, string>>> {
  const params = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    limit: "500",
    offset: "0",
  });

  for (const [key, value] of Object.entries(query)) params.set(key, value);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(`${CARGO_API}?${params.toString()}`, {
      headers: { "user-agent": USER_AGENT },
    });

    if (!response.ok) throw new Error(`Leaguepedia fetch failed: ${response.status}`);

    const body = (await response.json()) as {
      cargoquery?: Array<{ title: Record<string, string> }> | Array<Record<string, string>>;
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

    await sleep(REQUEST_DELAY_MS);

    // cargoquery response shape is slightly inconsistent depending on query params.
    const rows = (body.cargoquery ?? []) as Array<Record<string, string>>;
    // When "limit/offset" are used, the response typically returns objects already.
    // When `cargoquery` returns `{title: ...}`, normalize it.
    const normalized = rows.map((row: any) => (row.title ? row.title : row));
    return normalized as Array<Record<string, string>>;
  }

  throw new Error("Leaguepedia rate limit retries exhausted.");
}

async function fetchTournamentRosters(overviewPage: string) {
  return cargoQuery({
    tables: "TournamentRosters",
    fields: "Team,RosterLinks,Roles",
    where: `Tournament='${escapeCargoValue(overviewPage)}'`,
  });
}

async function fetchTournamentPlayers(overviewPage: string) {
  return cargoQuery({
    tables: "TournamentPlayers",
    fields: "Player,Team,Role",
    where: `Tournament='${escapeCargoValue(overviewPage)}'`,
  });
}

async function loadTeamsCache(supabase: any) {
  const { data, error } = await supabase.from("teams").select("id, slug, name, short_name, leaguepedia_page, source_team_id, is_lck_team");
  if (error) throw error;

  const teams = (data ?? []) as TeamRow[];
  const bySlug = new Map<string, TeamRow>();
  const byLeaguepediaKey = new Map<string, TeamRow>();

  for (const team of teams) {
    bySlug.set(team.slug, team);
    for (const key of [team.leaguepedia_page, team.source_team_id, team.name, team.short_name]) {
      const normalized = normalizeLookupKey(key);
      if (normalized) byLeaguepediaKey.set(normalized, team);
    }
  }

  return { bySlug, byLeaguepediaKey };
}

async function findOrCreateInternationalTeam(
  supabase: any,
  leaguepediaTeamName: string,
  cache: Awaited<ReturnType<typeof loadTeamsCache>>,
) {
  const displayName = displayNameFromLeaguepediaPage(leaguepediaTeamName);
  const slug = slugifyTeamName(displayName);
  if (!slug) return null;

  const cached = cache.bySlug.get(slug);
  if (cached) return cached;

  const shortName = displayName.length <= 12 ? displayName : displayName.split(/\s+/)[0].substring(0, 20);

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
        leaguepedia_page: leaguepediaTeamName,
        source_team_id: leaguepediaSourceId(leaguepediaTeamName),
        is_lck_team: false,
        imported_scope: "international_event",
        is_active: true,
      },
      { onConflict: "slug", ignoreDuplicates: true },
    )
    .select("id, slug, name, short_name, leaguepedia_page, source_team_id, is_lck_team")
    .maybeSingle();

  if (error) throw error;

  let team = data as TeamRow | null;
  if (!team) {
    // 충돌로 insert가 스킵된 경우(캐시에 없던 기존 팀) — 기존 행을 그대로 사용한다.
    const { data: existing, error: existingError } = await supabase
      .from("teams")
      .select("id, slug, name, short_name, leaguepedia_page, source_team_id, is_lck_team")
      .eq("slug", slug)
      .single();
    if (existingError) throw existingError;
    team = existing as TeamRow;
  }
  cache.bySlug.set(team.slug, team);
  const normalized = normalizeLookupKey(team.leaguepedia_page ?? team.name);
  if (normalized) cache.byLeaguepediaKey.set(normalized, team);
  return team;
}

async function determineInternationalOverviewPages(
  supabase: any,
  mode: LeaguepediaSyncMode,
): Promise<string[]> {
  const allIntl = SEASON_2026_TOURNAMENTS.filter((t) => t.category === "international");
  if (mode === "full") return allIntl.map((t) => t.overviewPage);

  const cursor = await getLastCompletedMatchCursor(supabase);
  if (!cursor) return allIntl.map((t) => t.overviewPage);

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("tournament_id, match_date")
    .not("tournament_id", "is", null)
    .gt("match_date", cursor);

  if (matchesError) throw matchesError;

  const tournamentIds = [...new Set((matches ?? []).map((m: any) => m.tournament_id).filter(Boolean))];
  if (tournamentIds.length === 0) return [];

  const { data: tournaments, error: tournamentsError } = await supabase
    .from("tournaments")
    .select("source_tournament_id, category")
    .in("id", tournamentIds)
    .eq("category", "international")
    .not("source_tournament_id", "is", null);

  if (tournamentsError) throw tournamentsError;

  return (tournaments ?? [])
    .map((t: any) => t.source_tournament_id)
    .filter((v: any): v is string => Boolean(v));
}

async function main() {
  loadEnvFile();

  const mode: LeaguepediaSyncMode = process.argv.includes("--full") ? "full" : "incremental";
  const initialDelayMs = mode === "full" ? 5000 : 0;
  if (initialDelayMs > 0) await sleep(initialDelayMs);

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  ) as any;

  const overviewPages = await determineInternationalOverviewPages(supabase, mode);
  if (overviewPages.length === 0) {
    console.log(JSON.stringify({ mode, processedTournaments: 0, upsertedPlayers: 0, upsertedTeams: 0, skipped: [] }));
    return;
  }

  console.log(`국제 로스터 동기화 시작 (모드: ${mode})`);
  console.log(`대상 TournamentRosters/TournamentPlayers: ${overviewPages.join(", ")}`);

  const teamsCache = await loadTeamsCache(supabase);

  const processed = {
    teamsUpserted: 0,
    playersUpserted: 0,
    skipped: [] as Array<{ overviewPage: string; reason: string; detail?: string }>,
  };

  for (const overviewPage of overviewPages) {
    console.log(`\n[${overviewPage}] rosters fetch...`);

    let rosters: Array<Record<string, string>> = [];
    try {
      rosters = await fetchTournamentRosters(overviewPage);
    } catch (err) {
      processed.skipped.push({ overviewPage, reason: `TournamentRosters fetch error:${(err as Error).message}` });
    }

    const playersByTeamSlug = new Map<
      string,
      { teamName: string; entries: Array<{ page: string; role: string }> }
    >();

    // 1) TournamentRosters 우선
    for (const row of rosters) {
      const teamName = row.Team?.trim();
      if (!teamName) continue;

      const rosterLinks = parseRosterField(row.RosterLinks);
      const roles = parseRosterField(row.Roles);
      if (rosterLinks.length === 0) continue;

      const displayTeamName = displayNameFromLeaguepediaPage(teamName);
      const teamSlug = slugifyTeamName(displayTeamName);
      if (!teamSlug) continue;

      const entries: Array<{ page: string; role: string }> = [];
      for (let i = 0; i < rosterLinks.length; i++) {
        const page = rosterLinks[i];
        const role = roles[i] ?? "";
        if (!page) continue;
        entries.push({ page, role });
      }

      if (entries.length > 0) playersByTeamSlug.set(teamSlug, { teamName, entries });
    }

    // 2) 비었으면 TournamentPlayers로 폴백
    if (playersByTeamSlug.size === 0) {
      console.log(`  [${overviewPage}] roster empty → TournamentPlayers 폴백`);
      const players = await fetchTournamentPlayers(overviewPage);
      for (const row of players) {
        const teamName = row.Team?.trim();
        const page = row.Player?.trim();
        const role = row.Role?.trim();
        if (!teamName || !page) continue;
        const teamSlug = slugifyTeamName(displayNameFromLeaguepediaPage(teamName));
        if (!teamSlug) continue;

        const existing = playersByTeamSlug.get(teamSlug);
        if (!existing) {
          playersByTeamSlug.set(teamSlug, { teamName, entries: [{ page, role: role ?? "" }] });
          continue;
        }
        existing.entries.push({ page, role: role ?? "" });
      }
    }

    console.log(`  collected teams: ${playersByTeamSlug.size}`);

    // 3) Supabase upsert
    for (const [teamSlug, { teamName, entries }] of playersByTeamSlug.entries()) {
      const cachedTeam =
        teamsCache.bySlug.get(teamSlug) ??
        teamsCache.byLeaguepediaKey.get(normalizeLookupKey(teamName)) ??
        null;

      let team = cachedTeam;
      if (!team) {
        team = await findOrCreateInternationalTeam(supabase, teamName, teamsCache);
        if (!team) {
          processed.skipped.push({ overviewPage, reason: "team_create_failed", detail: `${teamName}(${teamSlug})` });
          continue;
        }
        processed.teamsUpserted += 1;
      }

      for (const ref of entries) {
        const position = normalizeRole(ref.role);
        if (!position) {
          processed.skipped.push({
            overviewPage,
            reason: "unknown_position",
            detail: `${ref.page} role=${ref.role}`,
          });
          continue;
        }

        const playerPage = ref.page;
        const displayName = displayNameFromLeaguepediaPage(playerPage);
        const slug = makePlayerSlug(displayName);
        if (!slug) continue;

        const { error } = await supabase.from("players").upsert(
          {
            slug,
            name: displayName,
            real_name: null,
            team_id: team.id,
            position,
            leaguepedia_page: playerPage,
            source_player_id: leaguepediaSourceId(playerPage),
            is_lck_player: team.is_lck_team,
            imported_scope: team.is_lck_team ? "lck" : "international_event",
            is_active: true,
          },
          { onConflict: "slug" },
        );

        if (error) throw error;
        processed.playersUpserted += 1;
      }
    }
  }

  console.log(JSON.stringify(processed, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

