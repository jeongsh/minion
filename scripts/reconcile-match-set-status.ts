import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { computeMatchAggregate } from "../lib/match-reconcile.ts";
import { deriveSetStatus, hasCompletePlayerStats } from "../lib/set-status.ts";
import type { MatchStatus, SetStatus } from "../lib/types.ts";

/**
 * 매치/세트 상태 불일치를 읽기 전용으로 진단한다. 이 스크립트는 어떤 테이블도 쓰지 않는다.
 * 실제 데이터 복구(쓰기)는 별도 단계에서 이 스크립트의 결과를 검토한 뒤 진행한다.
 *
 * 사용법:
 *   npm run diagnose:match-set-status -- --all
 *   npm run diagnose:match-set-status -- --tournament=<uuid-or-name>
 *   npm run diagnose:match-set-status -- --match=<uuid-or-leaguepedia-id>
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHUNK_SIZE = 100;
const MAX_EXAMPLES = 20;

type MatchRow = {
  id: string;
  name: string;
  leaguepedia_match_id: string | null;
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

async function selectInChunks<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  ids: string[],
): Promise<T[]> {
  const rows: T[] = [];
  for (const batch of chunk(ids, CHUNK_SIZE)) {
    const { data, error } = await supabase.from(table).select(columns).in(column, batch);
    if (error) {
      throw error;
    }
    rows.push(...((data ?? []) as T[]));
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

type MatchMismatch = {
  matchId: string;
  name: string;
  before: { score: string; status: MatchStatus; winnerTeamId: string | null };
  after: { score: string; status: MatchStatus; winnerTeamId: string | null };
};

type SetMismatch = {
  setId: string;
  matchId: string;
  setNumber: number;
  before: SetStatus;
  after: SetStatus;
};

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
      "id, name, leaguepedia_match_id, team_a_id, team_b_id, best_of, status, team_a_score, team_b_score, winner_team_id",
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

  const setRows = await selectInChunks<SetRow>(
    supabase,
    "sets",
    "id, match_id, set_number, status, winner_team_id, blue_team_id, red_team_id, duration_seconds, blue_kills, red_kills",
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

  const setsByMatch = new Map<string, SetRow[]>();
  for (const set of setRows) {
    const list = setsByMatch.get(set.match_id);
    if (list) {
      list.push(set);
    } else {
      setsByMatch.set(set.match_id, [set]);
    }
  }

  const pickCountBySet = new Map<string, number>();
  const banCountBySet = new Map<string, number>();
  for (const row of pickBanRows) {
    const counter = row.action_type === "pick" ? pickCountBySet : banCountBySet;
    counter.set(row.set_id, (counter.get(row.set_id) ?? 0) + 1);
  }

  const playerStatsBySet = new Map<string, Array<{ playerId: string; teamId: string; position: string }>>();
  for (const row of playerStatRows) {
    const list = playerStatsBySet.get(row.set_id);
    const entry = { playerId: row.player_id, teamId: row.team_id, position: row.position };
    if (list) {
      list.push(entry);
    } else {
      playerStatsBySet.set(row.set_id, [entry]);
    }
  }

  // --- 세트 단위 진단 ---
  const setStatusMismatches: SetMismatch[] = [];
  const setStatusTransitionCounts = new Map<string, number>();
  const winnerButScheduled: SetMismatch[] = [];
  const hasDataButEarlyStatus: SetMismatch[] = [];
  const incompletePlayerStats: SetRow[] = [];
  const setWinnerOutsideParticipants: SetRow[] = [];
  const setSameBlueRedTeam: SetRow[] = [];
  const setTeamOutsideMatch: SetRow[] = [];
  const setNumberAnomalies: Array<{ matchId: string; issue: string; setIds: string[] }> = [];

  for (const match of matches) {
    const sets = setsByMatch.get(match.id) ?? [];

    const setNumbers = new Map<number, string[]>();
    for (const set of sets) {
      const list = setNumbers.get(set.set_number) ?? [];
      list.push(set.id);
      setNumbers.set(set.set_number, list);
    }
    for (const [setNumber, ids] of setNumbers) {
      if (ids.length > 1) {
        setNumberAnomalies.push({ matchId: match.id, issue: `세트 번호 ${setNumber} 중복(${ids.length}건)`, setIds: ids });
      }
    }
    if (match.best_of) {
      const overflow = sets.filter((set) => set.set_number > match.best_of!);
      if (overflow.length > 0) {
        setNumberAnomalies.push({
          matchId: match.id,
          issue: `best_of(${match.best_of})보다 큰 세트 번호`,
          setIds: overflow.map((set) => set.id),
        });
      }
    }

    for (const set of sets) {
      if (set.blue_team_id && set.red_team_id && set.blue_team_id === set.red_team_id) {
        setSameBlueRedTeam.push(set);
      }
      const participantIds = new Set([match.team_a_id, match.team_b_id].filter(Boolean));
      if ((set.blue_team_id && !participantIds.has(set.blue_team_id)) || (set.red_team_id && !participantIds.has(set.red_team_id))) {
        setTeamOutsideMatch.push(set);
      }
      if (set.winner_team_id && set.winner_team_id !== set.blue_team_id && set.winner_team_id !== set.red_team_id) {
        setWinnerOutsideParticipants.push(set);
      }

      const hasGameStats =
        set.winner_team_id != null || set.duration_seconds != null || set.blue_kills != null || set.red_kills != null;
      const pickCount = pickCountBySet.get(set.id) ?? 0;
      const banCount = banCountBySet.get(set.id) ?? 0;
      const playerStats = playerStatsBySet.get(set.id) ?? [];
      const complete = hasCompletePlayerStats(playerStats, set.blue_team_id, set.red_team_id);

      if (playerStats.length > 0 && !complete) {
        incompletePlayerStats.push(set);
      }

      const recomputedStatus = deriveSetStatus({
        hasGameStats,
        hasPlayerStats: complete,
        pickCount,
        banCount,
      });

      if (recomputedStatus !== set.status) {
        const mismatch: SetMismatch = {
          setId: set.id,
          matchId: match.id,
          setNumber: set.set_number,
          before: set.status,
          after: recomputedStatus,
        };
        setStatusMismatches.push(mismatch);
        const key = `${set.status} -> ${recomputedStatus}`;
        setStatusTransitionCounts.set(key, (setStatusTransitionCounts.get(key) ?? 0) + 1);
      }

      if (set.winner_team_id && set.status === "scheduled") {
        winnerButScheduled.push({
          setId: set.id,
          matchId: match.id,
          setNumber: set.set_number,
          before: set.status,
          after: recomputedStatus,
        });
      }

      const hasAnyResultData = hasGameStats || complete || pickCount > 0 || banCount > 0;
      if (hasAnyResultData && (set.status === "scheduled" || set.status === "draft_in_progress" || set.status === "draft_done")) {
        hasDataButEarlyStatus.push({
          setId: set.id,
          matchId: match.id,
          setNumber: set.set_number,
          before: set.status,
          after: recomputedStatus,
        });
      }
    }
  }

  // --- 매치 단위 진단 ---
  const matchMismatches: MatchMismatch[] = [];
  const matchWinnerOutsideParticipants: MatchRow[] = [];
  const matchSameTeams: MatchRow[] = [];
  const matchesSkippedNoTeams: MatchRow[] = [];

  for (const match of matches) {
    if (match.team_a_id && match.team_b_id && match.team_a_id === match.team_b_id) {
      matchSameTeams.push(match);
    }
    if (match.winner_team_id && match.winner_team_id !== match.team_a_id && match.winner_team_id !== match.team_b_id) {
      matchWinnerOutsideParticipants.push(match);
    }
    if (!match.team_a_id || !match.team_b_id) {
      matchesSkippedNoTeams.push(match);
      continue;
    }

    const confirmedSets = (setsByMatch.get(match.id) ?? []).filter((set) => set.winner_team_id != null);
    const next = computeMatchAggregate({
      teamAId: match.team_a_id,
      teamBId: match.team_b_id,
      bestOf: match.best_of,
      setResults: confirmedSets.map((set) => ({ winnerTeamId: set.winner_team_id })),
    });

    const changed =
      (match.team_a_score ?? 0) !== next.teamAScore ||
      (match.team_b_score ?? 0) !== next.teamBScore ||
      match.status !== next.status ||
      match.winner_team_id !== next.winnerTeamId;

    if (changed) {
      matchMismatches.push({
        matchId: match.id,
        name: match.name,
        before: {
          score: `${match.team_a_score ?? "null"}:${match.team_b_score ?? "null"}`,
          status: match.status,
          winnerTeamId: match.winner_team_id,
        },
        after: {
          score: `${next.teamAScore}:${next.teamBScore}`,
          status: next.status,
          winnerTeamId: next.winnerTeamId,
        },
      });
    }
  }

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
    console.log(`  - ${match.name} (${match.id}): winner_team_id=${match.winner_team_id}`);
  }

  console.log("");
  console.log(`[매치] 팀 A/B가 동일: ${matchSameTeams.length}건`);
  for (const match of matchSameTeams.slice(0, MAX_EXAMPLES)) {
    console.log(`  - ${match.name} (${match.id})`);
  }

  console.log("");
  console.log(`[세트] 현재 deriveSetStatus() 기준 상태 불일치: ${setStatusMismatches.length}건`);
  for (const [transition, count] of setStatusTransitionCounts) {
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
    console.log(`  - set ${set.id} (match ${set.match_id}, #${set.set_number}): winner_team_id=${set.winner_team_id}`);
  }

  console.log("");
  console.log(`[세트] 블루/레드 팀 동일: ${setSameBlueRedTeam.length}건`);
  console.log(`[세트] 블루/레드가 매치 참가팀 밖: ${setTeamOutsideMatch.length}건`);
  for (const set of setTeamOutsideMatch.slice(0, MAX_EXAMPLES)) {
    console.log(`  - set ${set.id} (match ${set.match_id}, #${set.set_number}): blue=${set.blue_team_id}, red=${set.red_team_id}`);
  }

  console.log("");
  console.log(`[세트] 세트 번호 이상: ${setNumberAnomalies.length}건`);
  for (const anomaly of setNumberAnomalies.slice(0, MAX_EXAMPLES)) {
    console.log(`  - match ${anomaly.matchId}: ${anomaly.issue} (${anomaly.setIds.join(", ")})`);
  }

  console.log("");
  console.log(`[세트] 불완전 선수 스탯(1~9명): ${incompletePlayerStats.length}건`);
  for (const set of incompletePlayerStats.slice(0, MAX_EXAMPLES)) {
    console.log(`  - set ${set.id} (match ${set.match_id}, #${set.set_number})`);
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
