import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { countLeaguepediaScoreboardGames, syncLeaguepediaMatchSets } from "../lib/sync/leaguepedia-match-sets.ts";

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
    .select("id, leaguepedia_match_id, status, match_date, team_a_score, team_b_score, sets(id)")
    .not("leaguepedia_match_id", "is", null)
    .neq("leaguepedia_match_id", "")
    .order("match_date", { ascending: true });
  if (tournamentIds) matchesQuery = matchesQuery.in("tournament_id", tournamentIds);

  const { data: matches, error } = await matchesQuery;
  if (error) throw error;

  type MatchEntry = {
    id: string;
    leaguepedia_match_id: string | null;
    status: string;
    match_date: string;
    team_a_score: number | null;
    team_b_score: number | null;
    sets: unknown[];
  };
  const now = Date.now();
  // 세트가 하나라도 있으면 끝난 걸로 치면, Leaguepedia에 일부 게임(예: 1세트)의
  // 상세 박스스코어가 아직 안 올라온 경우 그 세트를 영영 못 가져온다. 그렇다고 스코어
  // 기반으로 "완료된 게임 수"를 계산해서 비교하면 안 된다 — matches.team_a_score는
  // syncLeaguepediaMatchSets 끝의 reconcileMatchFromSets가 "지금 있는 세트"로부터
  // 역산하는 값이라, 세트가 0개면 스코어도 0:0으로 같이 역산되어 "세트 0 < 스코어 0"이
  // 항상 거짓이 되는 자기모순(순환 의존)에 빠진다 — 세트가 하나도 없는 경기는 영원히
  // 대상에서 빠져버렸다. status가 completed가 아닌 경기(아직 최종 스코어가 안 정해짐)는
  // 스코어 비교 없이 재시도하되, 경기 시작 시각이 아직 안 된 미래 경기까지 매번
  // Leaguepedia에 헛수고로 요청을 보낼 필요는 없으므로 시작 시각이 지난 경기만 대상으로
  // 삼는다. completed인 경기만 스코어 대비 세트 수로 "이미 다 채워졌는지" 판단한다
  // (이 경우엔 스코어가 이미 확정값이라 안전하다).
  const eligible = ((matches ?? []) as MatchEntry[]).filter((m) => {
    if (force) return true;
    if (m.status !== "completed") return new Date(m.match_date).getTime() <= now;
    const completedGames = (m.team_a_score ?? 0) + (m.team_b_score ?? 0);
    return (m.sets?.length ?? 0) < completedGames;
  });

  console.log(`처리할 경기: ${eligible.length}개 (force: ${force})`);

  let processed = 0;
  let skipped = 0;
  let setsTotal = 0;
  let picksBansTotal = 0;
  let playerStatsTotal = 0;

  for (const [index, match] of eligible.entries()) {
    try {
      // 진행 중인 시리즈는 다음 세트가 언제 올라올지 몰라 매번 다시 대상에 포함되는데,
      // 그때마다 밴픽/선수 스탯/아이템·스펠·룬까지 통째로 다시 가져오는 건 낭비다.
      // 게임 수만 가볍게 먼저 확인해서, 로컬 세트 수보다 늘지 않았으면 무거운 동기화를
      // 건너뛴다. (완료된 경기는 위 eligible 필터에서 이미 스코어 기준으로 걸러진다.)
      if (!force && match.status !== "completed") {
        const knownGameCount = await countLeaguepediaScoreboardGames(match.leaguepedia_match_id!);
        const localSetCount = match.sets?.length ?? 0;
        if (knownGameCount <= localSetCount) {
          skipped++;
          console.log(
            JSON.stringify({ matchId: match.id, leaguepediaMatchId: match.leaguepedia_match_id, skipped: "변경 없음" }),
          );
          if (index < eligible.length - 1) await sleep(5000);
          continue;
        }
      }

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

    if (index < eligible.length - 1) {
      await sleep(5000);
    }
  }

  console.log(
    JSON.stringify(
      {
        force,
        matchesProcessed: processed,
        matchesSkippedNoChange: skipped,
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
