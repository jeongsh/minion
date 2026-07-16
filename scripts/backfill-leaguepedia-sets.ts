import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { syncLeaguepediaMatchSets } from "../lib/sync/leaguepedia-match-sets.ts";

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

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseSegmentArg() {
  const arg = process.argv.find((a) => a.startsWith("--segment="));
  return arg ? arg.split("=")[1]?.trim() || null : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tournamentIdsForSegment(supabase: any, segment: string): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from("tournaments").select("id");
  switch (segment) {
    case "lck":           q = q.eq("league", "LCK"); break;
    case "lck-cup":       q = q.eq("league", "LCK").eq("split", "Cup"); break;
    case "first-stand":   q = q.eq("league", "First Stand"); break;
    case "msi":           q = q.eq("league", "MSI"); break;
    case "ewc":           q = q.eq("league", "EWC"); break;
    case "worlds":        q = q.eq("league", "Worlds"); break;
    case "enc":           q = q.eq("league", "ENC"); break;
    case "international": q = q.eq("category", "international"); break;
    default:
      console.warn(`알 수 없는 세그먼트: ${segment}, 전체 처리`);
      return [];
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((t: { id: string }) => t.id);
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function main() {
  loadEnvFile();
  const force = process.argv.includes("--force");

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const segment = parseSegmentArg();
  let tournamentIds: string[] | null = null;
  if (segment) {
    tournamentIds = await tournamentIdsForSegment(supabase, segment);
    if (tournamentIds.length === 0) {
      console.log(`세그먼트 '${segment}'에 해당하는 토너먼트가 없습니다.`);
      return;
    }
    console.log(`리그 필터: ${segment} (토너먼트 ${tournamentIds.length}개)`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matchesQuery: any = supabase
    .from("matches")
    .select("id, leaguepedia_match_id, team_a_score, team_b_score, sets(id)")
    .not("leaguepedia_match_id", "is", null)
    .neq("leaguepedia_match_id", "")
    .order("match_date", { ascending: true });
  if (tournamentIds) matchesQuery = matchesQuery.in("tournament_id", tournamentIds);

  const { data: matches, error } = await matchesQuery;
  if (error) throw error;

  type MatchEntry = {
    id: string;
    leaguepedia_match_id: string | null;
    team_a_score: number | null;
    team_b_score: number | null;
    sets: unknown[];
  };
  // 세트가 하나라도 있으면 끝난 걸로 치면, Leaguepedia에 일부 게임(예: 1세트)의
  // 상세 박스스코어가 아직 안 올라온 경우 그 세트를 영영 못 가져온다. 스코어로
  // 추정한 "완료된 게임 수"보다 세트 수가 적으면 --force 없이도 계속 재시도한다.
  const eligible = ((matches ?? []) as MatchEntry[]).filter((m) => {
    if (force) return true;
    const completedGames = (m.team_a_score ?? 0) + (m.team_b_score ?? 0);
    return (m.sets?.length ?? 0) < completedGames;
  });

  console.log(`처리할 경기: ${eligible.length}개 (force: ${force})`);

  let processed = 0;
  let setsTotal = 0;
  let picksBansTotal = 0;
  let playerStatsTotal = 0;

  for (const match of eligible) {
    try {
      const summary = await syncLeaguepediaMatchSets(supabase, match.id);
      setsTotal += summary.upserted;
      picksBansTotal += summary.picksBansUpserted;
      playerStatsTotal += summary.playerStatsUpserted;
      processed++;
      console.log(
        JSON.stringify({
          matchId: match.id,
          leaguepediaMatchId: match.leaguepedia_match_id,
          sets: summary.upserted,
          picksBans: summary.picksBansUpserted,
          playerStats: summary.playerStatsUpserted,
          items: summary.itemsResolved,
          spells: summary.spellsResolved,
          runes: summary.runesResolved,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(JSON.stringify({ matchId: match.id, leaguepediaMatchId: match.leaguepedia_match_id, error: msg }));
    }

    if (processed < eligible.length) {
      await sleep(5000);
    }
  }

  console.log(
    JSON.stringify(
      {
        force,
        matchesProcessed: processed,
        setsUpserted: setsTotal,
        picksBansUpserted: picksBansTotal,
        playerStatsUpserted: playerStatsTotal,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
