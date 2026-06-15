import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SEASON_2026_TOURNAMENTS } from "../lib/tournaments/season-2026";

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 4000;
const MAX_RETRIES = 10;

const GOL_TO_LP_OVERVIEW: Record<string, string> = {
  "gol:LCK%20Cup%202026": "LCK/2026 Season/Cup",
  "gol:LCK%202026%20Rounds%201-2": "LCK/2026 Season/Rounds 1-2",
  "gol:LCK%202026%20Road%20to%20MSI": "LCK/2026 Season/Road to MSI",
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
  ["brion", "bro"],
  ["bro", "bro"],
  ["bnk fearx", "fox"],
  ["bfx", "fox"],
  ["dn soopers", "soop"],
  ["dns", "soop"],
  ["soop", "soop"],
]);

type TeamRow = { id: string; slug: string; short_name: string };
type DbMatch = {
  id: string;
  name: string;
  match_date: string;
  team_a_id: string;
  team_b_id: string;
  team_a_score: number | null;
  team_b_score: number | null;
  status: string;
  leaguepedia_match_id: string | null;
  tournament_id: string;
  stage_id: string | null;
};
type CargoRow = {
  MatchId: string;
  DateTime_UTC: string;
  GameDateTime?: string;
  Team1: string;
  Team2: string;
  Team1Score?: string;
  Team2Score?: string;
  Winner?: string;
  BestOf?: string;
  Tab?: string;
  Round?: string;
  ShownName?: string;
  FF?: string;
};

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=");
    }
  } catch {
    // optional
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeTeamName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function teamSlugFor(name: string) {
  return TEAM_ALIASES.get(normalizeTeamName(name));
}

function parseInteger(value: string | undefined | null) {
  if (value === "" || value == null) return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMatchDate(value: string | undefined) {
  if (!value || !/\d{4}/.test(String(value))) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function matchDateFromRow(row: CargoRow) {
  return parseMatchDate(row.DateTime_UTC) ?? parseMatchDate(row.GameDateTime);
}

function matchDayKST(isoDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate));
}

function pairKey(slugA: string, slugB: string) {
  return [slugA, slugB].sort().join("|");
}

function stageNameFromRow(row: CargoRow) {
  const parts = [row.Tab, row.Round].filter((p) => p && p.trim());
  return parts.length > 0 ? parts.join(" - ") : "Main";
}

function statusFromRow(row: CargoRow) {
  const scoreA = parseInteger(row.Team1Score);
  const scoreB = parseInteger(row.Team2Score);
  const winner = parseInteger(row.Winner);
  if (row.FF === "1" || winner === 1 || winner === 2) return "completed";
  if (Number.isFinite(scoreA) && Number.isFinite(scoreB)) return "completed";
  return "scheduled";
}

function winnerTeamIdFromRow(row: CargoRow, teamA: TeamRow, teamB: TeamRow) {
  const winner = parseInteger(row.Winner);
  if (winner === 1) return teamA.id;
  if (winner === 2) return teamB.id;
  const scoreA = parseInteger(row.Team1Score);
  const scoreB = parseInteger(row.Team2Score);
  if (scoreA == null || scoreB == null) return null;
  if (scoreA > scoreB) return teamA.id;
  if (scoreB > scoreA) return teamB.id;
  return null;
}

async function cargoQuery(query: Record<string, string>, offset = 0) {
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
      headers: { "user-agent": "LCKHubMinion/0.1 (gol migration)" },
    });
    if (!response.ok) throw new Error(`Cargo fetch failed: ${response.status}`);

    const body = (await response.json()) as {
      cargoquery?: Array<{ title: CargoRow }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      const waitMs = REQUEST_DELAY_MS * (attempt + 2);
      console.warn(`Rate limited. Retrying in ${waitMs}ms...`);
      await sleep(waitMs);
      continue;
    }
    if (body.error) throw new Error(body.error.info ?? body.error.code);

    return (body.cargoquery ?? []).map((e) => e.title);
  }
  throw new Error("Rate limit retries exhausted");
}

async function fetchCargoForOverview(overviewPage: string) {
  const rows: CargoRow[] = [];
  let offset = 0;
  while (true) {
    const batch = await cargoQuery({
      tables: "MatchSchedule",
      fields:
        "MatchId,DateTime_UTC,Team1,Team2,Team1Score,Team2Score,Winner,BestOf,Tab,Round,ShownName,FF",
      where: `OverviewPage="${overviewPage}"`,
      order_by: "DateTime_UTC",
      order_by_options: "ASC",
    }, offset);

    rows.push(...batch);
    if (batch.length < 500) break;
    offset += 500;
    await sleep(REQUEST_DELAY_MS);
  }
  return rows;
}

async function findOrCreateStage(
  supabase: SupabaseClient,
  tournamentId: string,
  stageName: string,
  index: number,
) {
  const { data: existing } = await supabase
    .from("stages")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("name", stageName)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("stages")
    .insert({ tournament_id: tournamentId, name: stageName, order_index: index })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function main() {
  loadEnvFile();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, slug, short_name");
  if (teamsError) throw teamsError;

  const bySlug = new Map(teams.map((t) => [t.slug, t]));
  const byId = new Map(teams.map((t) => [t.id, t]));

  const { data: tournaments, error: tourError } = await supabase
    .from("tournaments")
    .select("id, name, source, source_tournament_id, split");
  if (tourError) throw tourError;

  const lpTourByOverview = new Map(
    tournaments
      .filter((t) => t.source === "leaguepedia")
      .map((t) => [t.source_tournament_id, t.id]),
  );
  const golTourBySourceId = new Map(
    tournaments
      .filter((t) => t.source === "gol.gg")
      .map((t) => [t.source_tournament_id, t.id]),
  );

  const { data: dbMatches, error: matchError } = await supabase
    .from("matches")
    .select("id, name, match_date, team_a_id, team_b_id, team_a_score, team_b_score, status, leaguepedia_match_id, tournament_id, stage_id")
    .like("leaguepedia_match_id", "gol:%")
    .order("match_date");
  if (matchError) throw matchError;

  console.log(`GOL 경기 ${dbMatches.length}건 로드`);

  const summary = {
    updated: 0,
    unmatched: [] as Array<{ id: string; name: string; reason: string }>,
    cargoFetched: 0,
  };

  const overviewPages = [...new Set(Object.values(GOL_TO_LP_OVERVIEW))];

  for (const overviewPage of overviewPages) {
    console.log(`\nCargo 조회: ${overviewPage}`);
    await sleep(REQUEST_DELAY_MS * 2);
    const cargoRows = await fetchCargoForOverview(overviewPage);
    summary.cargoFetched += cargoRows.length;
    console.log(`  → ${cargoRows.length}건`);

    const lpTournamentId = lpTourByOverview.get(overviewPage);
    if (!lpTournamentId) {
      console.warn(`  Leaguepedia 토너먼트 없음: ${overviewPage}`);
      continue;
    }

    const golTournamentIds = Object.entries(GOL_TO_LP_OVERVIEW)
      .filter(([, lp]) => lp === overviewPage)
      .map(([gol]) => golTourBySourceId.get(gol))
      .filter(Boolean) as string[];

    const golMatches = dbMatches.filter((m) => golTournamentIds.includes(m.tournament_id));

    // Cargo 인덱스: 팀쌍+스코어 (날짜 없어도 매칭 가능)
    const cargoByPairScore = new Map<string, CargoRow[]>();
    const cargoByPairDay = new Map<string, CargoRow[]>();
    const stageOrder = new Map<string, number>();

    for (const row of cargoRows) {
      const slugA = teamSlugFor(row.Team1?.trim() ?? "");
      const slugB = teamSlugFor(row.Team2?.trim() ?? "");
      if (!slugA || !slugB) continue;

      const pair = pairKey(slugA, slugB);
      const scoreA = parseInteger(row.Team1Score);
      const scoreB = parseInteger(row.Team2Score);
      if (scoreA != null && scoreB != null) {
        const scoreKey = `${pair}|${scoreA}-${scoreB}|${slugA}`;
        const list = cargoByPairScore.get(scoreKey) ?? [];
        list.push(row);
        cargoByPairScore.set(scoreKey, list);
      }

      const date = matchDateFromRow(row);
      if (date) {
        const day = matchDayKST(date);
        const key = `${pair}|${day}`;
        const list = cargoByPairDay.get(key) ?? [];
        list.push(row);
        cargoByPairDay.set(key, list);
      }
    }

    const usedCargoIds = new Set<string>();

    for (const dbMatch of golMatches) {
      const teamA = byId.get(dbMatch.team_a_id);
      const teamB = byId.get(dbMatch.team_b_id);
      if (!teamA || !teamB) {
        summary.unmatched.push({ id: dbMatch.id, name: dbMatch.name, reason: "team_not_found" });
        continue;
      }

      const pair = pairKey(teamA.slug, teamB.slug);
      const day = matchDayKST(dbMatch.match_date);
      const dbA = dbMatch.team_a_score;
      const dbB = dbMatch.team_b_score;

      let cargoCandidates: CargoRow[] = [];

      // 1) 팀쌍 + 스코어 (가장 확실)
      if (dbA != null && dbB != null) {
        const keyDirect = `${pair}|${dbA}-${dbB}|${teamA.slug}`;
        const keySwap = `${pair}|${dbB}-${dbA}|${teamB.slug}`;
        cargoCandidates = [
          ...(cargoByPairScore.get(keyDirect) ?? []),
          ...(cargoByPairScore.get(keySwap) ?? []),
        ].filter((r) => !usedCargoIds.has(r.MatchId));
      }

      // 2) 팀쌍 + 날짜
      if (cargoCandidates.length === 0) {
        cargoCandidates = (cargoByPairDay.get(`${pair}|${day}`) ?? []).filter(
          (r) => !usedCargoIds.has(r.MatchId),
        );
        if (cargoCandidates.length > 1 && dbA != null && dbB != null) {
          const narrowed = cargoCandidates.filter((r) => {
            const slugA = teamSlugFor(r.Team1?.trim() ?? "");
            const aIsTeamA = slugA === teamA.slug;
            const lpScoreA = parseInteger(r.Team1Score);
            const lpScoreB = parseInteger(r.Team2Score);
            if (lpScoreA == null || lpScoreB == null) return true;
            return aIsTeamA
              ? lpScoreA === dbA && lpScoreB === dbB
              : lpScoreA === dbB && lpScoreB === dbA;
          });
          if (narrowed.length > 0) cargoCandidates = narrowed;
        }
      }

      if (cargoCandidates.length === 0) {
        summary.unmatched.push({
          id: dbMatch.id,
          name: dbMatch.name,
          reason: `no_cargo_match (${teamA.short_name} vs ${teamB.short_name}, ${day})`,
        });
        continue;
      }

      const cargo = cargoCandidates[0];
      usedCargoIds.add(cargo.MatchId);

      const lpSlugA = teamSlugFor(cargo.Team1?.trim() ?? "");
      const lpSlugB = teamSlugFor(cargo.Team2?.trim() ?? "");
      const lpTeamA = lpSlugA ? bySlug.get(lpSlugA) : null;
      const lpTeamB = lpSlugB ? bySlug.get(lpSlugB) : null;
      if (!lpTeamA || !lpTeamB) {
        summary.unmatched.push({ id: dbMatch.id, name: dbMatch.name, reason: "cargo_team_resolve_failed" });
        continue;
      }

      const matchDate = matchDateFromRow(cargo) ?? dbMatch.match_date;
      const stageName = stageNameFromRow(cargo);
      if (!stageOrder.has(stageName)) stageOrder.set(stageName, stageOrder.size);
      const stageId = await findOrCreateStage(
        supabase,
        lpTournamentId,
        stageName,
        stageOrder.get(stageName)!,
      );

      const aIsDbTeamA = lpSlugA === teamA.slug;
      const lpScoreA = parseInteger(cargo.Team1Score);
      const lpScoreB = parseInteger(cargo.Team2Score);

      const payload = {
        tournament_id: lpTournamentId,
        stage_id: stageId,
        name: cargo.ShownName?.trim() || `${lpTeamA.short_name} vs ${lpTeamB.short_name}`,
        match_date: matchDate,
        status: statusFromRow(cargo),
        team_a_id: lpTeamA.id,
        team_b_id: lpTeamB.id,
        team_a_score: aIsDbTeamA ? lpScoreA : lpScoreB,
        team_b_score: aIsDbTeamA ? lpScoreB : lpScoreA,
        best_of: parseInteger(cargo.BestOf),
        winner_team_id: winnerTeamIdFromRow(cargo, lpTeamA, lpTeamB),
        leaguepedia_match_id: cargo.MatchId,
      };

      const { error } = await supabase.from("matches").update(payload).eq("id", dbMatch.id);
      if (error) throw error;

      summary.updated += 1;
      console.log(
        `  ✓ ${dbMatch.leaguepedia_match_id} → ${cargo.MatchId}  (${teamA.short_name} vs ${teamB.short_name})`,
      );
    }
  }

  console.log("\n=== 결과 ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
