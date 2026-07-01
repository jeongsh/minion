import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { diagnoseMatches } from "../lib/match-diagnostics.ts";
import { reconcileMatchFromSets } from "../lib/match-reconcile.ts";
import type { MatchStatus, SetStatus } from "../lib/types.ts";

/**
 * 매치/세트 상태 불일치를 진단한다. --apply 없이는 어떤 테이블도 쓰지 않는다.
 *
 * 사용법:
 *   npm run diagnose:match-set-status -- --all
 *   npm run diagnose:match-set-status -- --tournament=<uuid-or-name>
 *   npm run diagnose:match-set-status -- --match=<uuid-or-leaguepedia-id>
 *   npm run diagnose:match-set-status -- --match=<...> --apply   (실제로 고침, 반드시 좁은 범위로 먼저)
 *
 * --apply가 있으면: matchMismatches는 reconcileMatchFromSets()로, setStatusMismatches는
 * 재계산된 status로 갱신한다. 참가팀 밖 승자/블루=레드/세트번호 이상/불완전 선수스탯은
 * 기계적으로 판단할 수 없어 --apply로도 고치지 않고 계속 진단만 한다(반드시 사람이 확인).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHUNK_SIZE = 100;
const MAX_EXAMPLES = 20;

type MatchRow = {
  id: string;
  name: string;
  leaguepedia_match_id: string | null;
  match_date: string;
  team_a_id: string | null;
  team_b_id: string | null;
  best_of: number | null;
  status: MatchStatus;
  team_a_score: number | null;
  team_b_score: number | null;
  winner_team_id: string | null;
};

type SetRow = {
  id: string;
  match_id: string;
  set_number: number;
  status: SetStatus;
  winner_team_id: string | null;
  blue_team_id: string | null;
  red_team_id: string | null;
  duration_seconds: number | null;
  blue_kills: number | null;
  red_kills: number | null;
  result_recorded_at: string | null;
};

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) {
        process.env[key] = valueParts.join("=");
      }
    }
  } catch {
    // .env.local is optional when env vars are already set.
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function argValue(flag: string) {
  const arg = process.argv.find((a) => a.startsWith(`${flag}=`));
  return arg ? arg.split("=").slice(1).join("=").trim() || null : null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

const PAGE_SIZE = 1000;

async function selectInChunks<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  ids: string[],
): Promise<T[]> {
  const rows: T[] = [];
  for (const batch of chunk(ids, CHUNK_SIZE)) {
    // 청크 하나(최대 CHUNK_SIZE개 id)의 결과도 PostgREST 기본 상한(1000행)을
    // 넘을 수 있어(예: set_picks_bans는 세트당 20건 안팎) range로 끝까지 페이지네이션한다.
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .in(column, batch)
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        throw error;
      }
      rows.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE_SIZE) {
        break;
      }
      from += PAGE_SIZE;
    }
  }
  return rows;
}

async function resolveMatchIds(supabase: SupabaseClient): Promise<{ matchIds: string[] | null; label: string }> {
  const all = process.argv.includes("--all");
  const matchArg = argValue("--match");
  const tournamentArg = argValue("--tournament");

  const selected = [all, matchArg, tournamentArg].filter(Boolean).length;
  if (selected === 0) {
    throw new Error(
      "범위를 지정해야 합니다: --all, --tournament=<uuid-or-name>, --match=<uuid-or-leaguepedia-id> 중 하나를 사용하세요.",
    );
  }
  if (selected > 1) {
    throw new Error("--all, --tournament, --match 중 하나만 사용하세요.");
  }

  if (all) {
    return { matchIds: null, label: "전체 매치" };
  }

  if (matchArg) {
    const { data, error } = await supabase
      .from("matches")
      .select("id")
      .or(UUID_RE.test(matchArg) ? `id.eq.${matchArg}` : `leaguepedia_match_id.eq.${matchArg}`);
    if (error) {
      throw error;
    }
    const ids = (data ?? []).map((row) => row.id as string);
    if (ids.length === 0) {
      throw new Error(`--match=${matchArg}에 해당하는 매치를 찾지 못했습니다.`);
    }
    return { matchIds: ids, label: `--match=${matchArg}` };
  }

  const tournamentArgValue = tournamentArg as string;
  let tournamentIds: string[];
  if (UUID_RE.test(tournamentArgValue)) {
    tournamentIds = [tournamentArgValue];
  } else {
    const { data, error } = await supabase
      .from("tournaments")
      .select("id, name")
      .ilike("name", `%${tournamentArgValue}%`);
    if (error) {
      throw error;
    }
    const matches = (data ?? []) as Array<{ id: string; name: string }>;
    if (matches.length === 0) {
      throw new Error(`--tournament=${tournamentArgValue}에 해당하는 대회를 찾지 못했습니다.`);
    }
    console.log(`대회 매칭: ${matches.map((t) => `${t.name} (${t.id})`).join(", ")}`);
    tournamentIds = matches.map((t) => t.id);
  }

  const { data: matchRows, error: matchError } = await supabase
    .from("matches")
    .select("id")
    .in("tournament_id", tournamentIds);
  if (matchError) {
    throw matchError;
  }
  const ids = (matchRows ?? []).map((row) => row.id as string);
  if (ids.length === 0) {
    throw new Error(`--tournament=${tournamentArgValue}에 해당하는 매치가 없습니다.`);
  }
  return { matchIds: ids, label: `--tournament=${tournamentArgValue}` };
}

async function main() {
  loadEnvFile();

  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { matchIds, label } = await resolveMatchIds(supabase);
  console.log(`진단 범위: ${label} (읽기 전용, 아무것도 쓰지 않습니다)`);

  let matchesQuery = supabase
    .from("matches")
    .select(
      "id, name, leaguepedia_match_id, match_date, team_a_id, team_b_id, best_of, status, team_a_score, team_b_score, winner_team_id",
    );
  if (matchIds) {
    matchesQuery = matchesQuery.in("id", matchIds);
  }
  const { data: matchData, error: matchError } = await matchesQuery;
  if (matchError) {
    throw matchError;
  }
  const matches = (matchData ?? []) as MatchRow[];
  const allMatchIds = matches.map((match) => match.id);
  const matchById = new Map(matches.map((match) => [match.id, match]));

  const setRows = await selectInChunks<SetRow>(
    supabase,
    "sets",
    "id, match_id, set_number, status, winner_team_id, blue_team_id, red_team_id, duration_seconds, blue_kills, red_kills, result_recorded_at",
    "match_id",
    allMatchIds,
  );
  const allSetIds = setRows.map((set) => set.id);

  const pickBanRows = await selectInChunks<{ set_id: string; action_type: string }>(
    supabase,
    "set_picks_bans",
    "set_id, action_type",
    "set_id",
    allSetIds,
  );
  const playerStatRows = await selectInChunks<{ set_id: string; player_id: string; team_id: string; position: string }>(
    supabase,
    "set_player_stats",
    "set_id, player_id, team_id, position",
    "set_id",
    allSetIds,
  );

  const diagnosis = diagnoseMatches(
    matches.map((match) => ({
      id: match.id,
      name: match.name,
      teamAId: match.team_a_id,
      teamBId: match.team_b_id,
      bestOf: match.best_of,
      status: match.status,
      teamAScore: match.team_a_score,
      teamBScore: match.team_b_score,
      winnerTeamId: match.winner_team_id,
    })),
    setRows.map((set) => ({
      id: set.id,
      matchId: set.match_id,
      setNumber: set.set_number,
      status: set.status,
      winnerTeamId: set.winner_team_id,
      blueTeamId: set.blue_team_id,
      redTeamId: set.red_team_id,
      durationSeconds: set.duration_seconds,
      blueKills: set.blue_kills,
      redKills: set.red_kills,
    })),
    pickBanRows.map((row) => ({ setId: row.set_id, actionType: row.action_type })),
    playerStatRows.map((row) => ({ setId: row.set_id, playerId: row.player_id, teamId: row.team_id, position: row.position })),
  );

  const {
    matchMismatches,
    matchWinnerOutsideParticipants,
    matchSameTeams,
    matchesSkippedNoTeams,
    setStatusMismatches,
    setStatusTransitionCounts,
    winnerButScheduled,
    hasDataButEarlyStatus,
    incompletePlayerStats,
    setWinnerOutsideParticipants,
    setSameBlueRedTeam,
    setTeamOutsideMatch,
    setNumberAnomalies,
  } = diagnosis;

  // --- 리포트 출력 ---
  console.log("");
  console.log(`매치: ${matches.length}건, 세트: ${setRows.length}건`);
  console.log("");

  console.log(`[매치] 스코어/상태/승자 재계산 불일치: ${matchMismatches.length}건`);
  for (const item of matchMismatches.slice(0, MAX_EXAMPLES)) {
    console.log(
      `  - ${item.name} (${item.matchId}): ${item.before.score}/${item.before.status}/승자=${item.before.winnerTeamId ?? "없음"} -> ${item.after.score}/${item.after.status}/승자=${item.after.winnerTeamId ?? "없음"}`,
    );
  }
  if (matchMismatches.length > MAX_EXAMPLES) {
    console.log(`  ... 외 ${matchMismatches.length - MAX_EXAMPLES}건`);
  }
  if (matchesSkippedNoTeams.length > 0) {
    console.log(`  (참가팀 미정으로 재계산 제외된 매치 ${matchesSkippedNoTeams.length}건)`);
  }

  console.log("");
  console.log(`[매치] 참가 팀 밖의 승자: ${matchWinnerOutsideParticipants.length}건`);
  for (const match of matchWinnerOutsideParticipants.slice(0, MAX_EXAMPLES)) {
    console.log(`  - ${match.name} (${match.id}): winner_team_id=${match.winnerTeamId}`);
  }

  console.log("");
  console.log(`[매치] 팀 A/B가 동일: ${matchSameTeams.length}건`);
  for (const match of matchSameTeams.slice(0, MAX_EXAMPLES)) {
    console.log(`  - ${match.name} (${match.id})`);
  }

  console.log("");
  console.log(`[세트] 현재 deriveSetStatus() 기준 상태 불일치: ${setStatusMismatches.length}건`);
  for (const [transition, count] of Object.entries(setStatusTransitionCounts)) {
    console.log(`  - ${transition}: ${count}건`);
  }

  console.log("");
  console.log(`[세트] 승자가 있지만 scheduled인 세트: ${winnerButScheduled.length}건`);
  for (const item of winnerButScheduled.slice(0, MAX_EXAMPLES)) {
    console.log(`  - set ${item.setId} (match ${item.matchId}, #${item.setNumber})`);
  }

  console.log("");
  console.log(`[세트] 결과/상세 데이터가 있지만 결과 이전 상태인 세트: ${hasDataButEarlyStatus.length}건`);
  for (const item of hasDataButEarlyStatus.slice(0, MAX_EXAMPLES)) {
    console.log(`  - set ${item.setId} (match ${item.matchId}, #${item.setNumber}): ${item.before} -> ${item.after}`);
  }

  console.log("");
  console.log(`[세트] 참가 팀 밖의 승자: ${setWinnerOutsideParticipants.length}건`);
  for (const set of setWinnerOutsideParticipants.slice(0, MAX_EXAMPLES)) {
    console.log(`  - set ${set.id} (match ${set.matchId}, #${set.setNumber}): winner_team_id=${set.winnerTeamId}`);
  }

  console.log("");
  console.log(`[세트] 블루/레드 팀 동일: ${setSameBlueRedTeam.length}건`);
  console.log(`[세트] 블루/레드가 매치 참가팀 밖: ${setTeamOutsideMatch.length}건`);
  for (const set of setTeamOutsideMatch.slice(0, MAX_EXAMPLES)) {
    console.log(`  - set ${set.id} (match ${set.matchId}, #${set.setNumber}): blue=${set.blueTeamId}, red=${set.redTeamId}`);
  }

  console.log("");
  console.log(`[세트] 세트 번호 이상: ${setNumberAnomalies.length}건`);
  for (const anomaly of setNumberAnomalies.slice(0, MAX_EXAMPLES)) {
    console.log(`  - match ${anomaly.matchId}: ${anomaly.issue} (${anomaly.setIds.join(", ")})`);
  }

  console.log("");
  console.log(`[세트] 불완전 선수 스탯(1~9명): ${incompletePlayerStats.length}건`);
  for (const set of incompletePlayerStats.slice(0, MAX_EXAMPLES)) {
    console.log(`  - set ${set.id} (match ${set.matchId}, #${set.setNumber})`);
  }

  console.log("");
  console.log(
    JSON.stringify(
      {
        matches: matches.length,
        sets: setRows.length,
        matchScoreStatusWinnerMismatches: matchMismatches.length,
        matchWinnerOutsideParticipants: matchWinnerOutsideParticipants.length,
        matchSameTeams: matchSameTeams.length,
        setStatusMismatches: setStatusMismatches.length,
        winnerButScheduled: winnerButScheduled.length,
        hasDataButEarlyStatus: hasDataButEarlyStatus.length,
        setWinnerOutsideParticipants: setWinnerOutsideParticipants.length,
        setSameBlueRedTeam: setSameBlueRedTeam.length,
        setTeamOutsideMatch: setTeamOutsideMatch.length,
        setNumberAnomalies: setNumberAnomalies.length,
        incompletePlayerStats: incompletePlayerStats.length,
      },
      null,
      2,
    ),
  );

  const apply = process.argv.includes("--apply");
  if (!apply) {
    console.log("");
    console.log("(dry-run — 실제로 고치려면 --apply를 추가하세요)");
    return;
  }

  console.log("");
  console.log("=== --apply: 실제로 고치는 중 ===");

  const setById = new Map(setRows.map((set) => [set.id, set]));
  let setsFixed = 0;
  for (const mismatch of setStatusMismatches) {
    const set = setById.get(mismatch.setId);
    const match = matchById.get(mismatch.matchId);
    if (!set || !match) continue;

    const enteringResultStatus =
      (mismatch.after === "finished" || mismatch.after === "data_synced") &&
      mismatch.before !== "finished" &&
      mismatch.before !== "data_synced";

    const update: { status: SetStatus; result_recorded_at?: string } = { status: mismatch.after };
    if (enteringResultStatus && !set.result_recorded_at) {
      // 트리거(set_sets_result_recorded_at)가 now()로 채우면 평점 입력창이 다시 열리므로,
      // 실제 결과 시각을 알 수 없는 과거 데이터는 매치 일시로 대신 채운다.
      update.result_recorded_at = match.match_date;
    }

    const { error: updateError } = await supabase.from("sets").update(update).eq("id", mismatch.setId);
    if (updateError) {
      throw updateError;
    }
    setsFixed += 1;
  }
  console.log(`세트 상태 ${setsFixed}건 갱신 완료`);

  let matchesFixed = 0;
  const matchIdsToReconcile = new Set(matchMismatches.map((mismatch) => mismatch.matchId));
  for (const matchId of matchIdsToReconcile) {
    const result = await reconcileMatchFromSets(supabase, matchId);
    if (result.changed) {
      matchesFixed += 1;
    }
  }
  console.log(`매치 스코어/상태/승자 ${matchesFixed}건 갱신 완료`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
