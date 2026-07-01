import type { SupabaseClient } from "@supabase/supabase-js";

import type { MatchStatus } from "@/lib/types";

export type MatchAggregateResult = {
  teamAScore: number;
  teamBScore: number;
  status: MatchStatus;
  winnerTeamId: string | null;
};

/**
 * 세트 결과로부터 매치 스코어/상태/승자를 계산한다.
 * 세트 결과가 하나도 없으면 기본 상태는 scheduled(불변조건 5.1) - 경기 시각 등으로
 * live를 추론하는 별도 신호는 두지 않는다(화면마다 다른 live 추론 기준이 문제였음).
 */
export function computeMatchAggregate(input: {
  teamAId: string;
  teamBId: string;
  bestOf: number | null;
  setResults: Array<{ winnerTeamId: string | null }>;
}): MatchAggregateResult {
  const { teamAId, teamBId, bestOf, setResults } = input;

  let winsA = 0;
  let winsB = 0;
  for (const set of setResults) {
    if (set.winnerTeamId === teamAId) {
      winsA += 1;
    } else if (set.winnerTeamId === teamBId) {
      winsB += 1;
    }
  }

  const finishedSetCount = winsA + winsB;
  const winsNeeded = bestOf ? Math.floor(bestOf / 2) + 1 : null;

  if (finishedSetCount === 0) {
    return { teamAScore: winsA, teamBScore: winsB, status: "scheduled", winnerTeamId: null };
  }

  if (winsNeeded !== null && Math.max(winsA, winsB) >= winsNeeded) {
    return {
      teamAScore: winsA,
      teamBScore: winsB,
      status: "completed",
      winnerTeamId: winsA > winsB ? teamAId : teamBId,
    };
  }

  return { teamAScore: winsA, teamBScore: winsB, status: "live", winnerTeamId: null };
}

export type ReconcileMatchResult = {
  matchId: string;
  changed: boolean;
  previous: {
    teamAScore: number | null;
    teamBScore: number | null;
    status: MatchStatus;
    winnerTeamId: string | null;
  };
  next: MatchAggregateResult;
};

/**
 * 매치의 확정된 세트 결과를 다시 집계해 매치 스코어/상태/승자를 갱신한다.
 * 모든 세트 생성/수정/동기화 경로는 성공 후 이 함수를 호출해야 한다.
 * 멱등: 계산 결과가 기존 값과 같으면 쓰기를 생략한다.
 */
export async function reconcileMatchFromSets(
  supabase: SupabaseClient,
  matchId: string,
): Promise<ReconcileMatchResult> {
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, best_of, status, team_a_score, team_b_score, winner_team_id")
    .eq("id", matchId)
    .single();

  if (matchError) {
    throw matchError;
  }

  const previous = {
    teamAScore: match.team_a_score as number | null,
    teamBScore: match.team_b_score as number | null,
    status: match.status as MatchStatus,
    winnerTeamId: match.winner_team_id as string | null,
  };

  if (!match.team_a_id || !match.team_b_id) {
    return { matchId, changed: false, previous, next: { ...previous, teamAScore: previous.teamAScore ?? 0, teamBScore: previous.teamBScore ?? 0 } };
  }

  const { data: sets, error: setsError } = await supabase
    .from("sets")
    .select("winner_team_id")
    .eq("match_id", matchId)
    .not("winner_team_id", "is", null);

  if (setsError) {
    throw setsError;
  }

  const next = computeMatchAggregate({
    teamAId: match.team_a_id as string,
    teamBId: match.team_b_id as string,
    bestOf: match.best_of as number | null,
    setResults: (sets ?? []).map((set) => ({ winnerTeamId: set.winner_team_id as string | null })),
  });

  const changed =
    previous.teamAScore !== next.teamAScore ||
    previous.teamBScore !== next.teamBScore ||
    previous.status !== next.status ||
    previous.winnerTeamId !== next.winnerTeamId;

  if (changed) {
    const { error: updateError } = await supabase
      .from("matches")
      .update({
        team_a_score: next.teamAScore,
        team_b_score: next.teamBScore,
        status: next.status,
        winner_team_id: next.winnerTeamId,
      })
      .eq("id", matchId);

    if (updateError) {
      throw updateError;
    }
  }

  return { matchId, changed, previous, next };
}
