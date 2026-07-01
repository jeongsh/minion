import { computeMatchAggregate } from "./match-reconcile.ts";
import { deriveSetStatus, hasCompletePlayerStats } from "./set-status.ts";
import type { MatchStatus, SetStatus } from "./types.ts";

export type DiagnosticMatchRow = {
  id: string;
  name: string;
  teamAId: string | null;
  teamBId: string | null;
  bestOf: number | null;
  status: MatchStatus;
  teamAScore: number | null;
  teamBScore: number | null;
  winnerTeamId: string | null;
};

export type DiagnosticSetRow = {
  id: string;
  matchId: string;
  setNumber: number;
  status: SetStatus;
  winnerTeamId: string | null;
  blueTeamId: string | null;
  redTeamId: string | null;
  durationSeconds: number | null;
  blueKills: number | null;
  redKills: number | null;
};

export type DiagnosticPickBanRow = { setId: string; actionType: string };
export type DiagnosticPlayerStatRow = { setId: string; playerId: string; teamId: string; position: string };

export type MatchScoreMismatch = {
  matchId: string;
  name: string;
  before: { score: string; status: MatchStatus; winnerTeamId: string | null };
  after: { score: string; status: MatchStatus; winnerTeamId: string | null };
};

export type SetStatusMismatch = {
  setId: string;
  matchId: string;
  setNumber: number;
  before: SetStatus;
  after: SetStatus;
};

export type SetNumberAnomaly = { matchId: string; issue: string; setIds: string[] };

export type MatchDiagnosis = {
  matchCount: number;
  setCount: number;
  matchMismatches: MatchScoreMismatch[];
  matchWinnerOutsideParticipants: DiagnosticMatchRow[];
  matchSameTeams: DiagnosticMatchRow[];
  matchesSkippedNoTeams: DiagnosticMatchRow[];
  setStatusMismatches: SetStatusMismatch[];
  setStatusTransitionCounts: Record<string, number>;
  winnerButScheduled: SetStatusMismatch[];
  hasDataButEarlyStatus: SetStatusMismatch[];
  incompletePlayerStats: DiagnosticSetRow[];
  setWinnerOutsideParticipants: DiagnosticSetRow[];
  setSameBlueRedTeam: DiagnosticSetRow[];
  setTeamOutsideMatch: DiagnosticSetRow[];
  setNumberAnomalies: SetNumberAnomaly[];
};

/**
 * 매치/세트 저장값을 도메인 로직(computeMatchAggregate, deriveSetStatus,
 * hasCompletePlayerStats)으로 다시 계산해 저장값과 비교한다. 읽기 전용 —
 * 아무것도 쓰지 않는다. scripts/reconcile-match-set-status.ts와 관리자
 * "데이터 일관성 재검사" 액션이 이 함수를 함께 사용한다.
 */
export function diagnoseMatches(
  matches: DiagnosticMatchRow[],
  sets: DiagnosticSetRow[],
  pickBanRows: DiagnosticPickBanRow[],
  playerStatRows: DiagnosticPlayerStatRow[],
): MatchDiagnosis {
  const setsByMatch = new Map<string, DiagnosticSetRow[]>();
  for (const set of sets) {
    const list = setsByMatch.get(set.matchId);
    if (list) {
      list.push(set);
    } else {
      setsByMatch.set(set.matchId, [set]);
    }
  }

  const pickCountBySet = new Map<string, number>();
  const banCountBySet = new Map<string, number>();
  for (const row of pickBanRows) {
    const counter = row.actionType === "pick" ? pickCountBySet : banCountBySet;
    counter.set(row.setId, (counter.get(row.setId) ?? 0) + 1);
  }

  const playerStatsBySet = new Map<string, Array<{ playerId: string; teamId: string; position: string }>>();
  for (const row of playerStatRows) {
    const list = playerStatsBySet.get(row.setId);
    const entry = { playerId: row.playerId, teamId: row.teamId, position: row.position };
    if (list) {
      list.push(entry);
    } else {
      playerStatsBySet.set(row.setId, [entry]);
    }
  }

  const setStatusMismatches: SetStatusMismatch[] = [];
  const setStatusTransitionCounts: Record<string, number> = {};
  const winnerButScheduled: SetStatusMismatch[] = [];
  const hasDataButEarlyStatus: SetStatusMismatch[] = [];
  const incompletePlayerStats: DiagnosticSetRow[] = [];
  const setWinnerOutsideParticipants: DiagnosticSetRow[] = [];
  const setSameBlueRedTeam: DiagnosticSetRow[] = [];
  const setTeamOutsideMatch: DiagnosticSetRow[] = [];
  const setNumberAnomalies: SetNumberAnomaly[] = [];

  for (const match of matches) {
    const matchSets = setsByMatch.get(match.id) ?? [];

    const setNumbers = new Map<number, string[]>();
    for (const set of matchSets) {
      const list = setNumbers.get(set.setNumber) ?? [];
      list.push(set.id);
      setNumbers.set(set.setNumber, list);
    }
    for (const [setNumber, ids] of setNumbers) {
      if (ids.length > 1) {
        setNumberAnomalies.push({ matchId: match.id, issue: `세트 번호 ${setNumber} 중복(${ids.length}건)`, setIds: ids });
      }
    }
    if (match.bestOf) {
      const overflow = matchSets.filter((set) => set.setNumber > match.bestOf!);
      if (overflow.length > 0) {
        setNumberAnomalies.push({
          matchId: match.id,
          issue: `best_of(${match.bestOf})보다 큰 세트 번호`,
          setIds: overflow.map((set) => set.id),
        });
      }
    }

    for (const set of matchSets) {
      if (set.blueTeamId && set.redTeamId && set.blueTeamId === set.redTeamId) {
        setSameBlueRedTeam.push(set);
      }
      const participantIds = new Set([match.teamAId, match.teamBId].filter(Boolean));
      if ((set.blueTeamId && !participantIds.has(set.blueTeamId)) || (set.redTeamId && !participantIds.has(set.redTeamId))) {
        setTeamOutsideMatch.push(set);
      }
      if (set.winnerTeamId && set.winnerTeamId !== set.blueTeamId && set.winnerTeamId !== set.redTeamId) {
        setWinnerOutsideParticipants.push(set);
      }

      const hasGameStats =
        set.winnerTeamId != null || set.durationSeconds != null || set.blueKills != null || set.redKills != null;
      const pickCount = pickCountBySet.get(set.id) ?? 0;
      const banCount = banCountBySet.get(set.id) ?? 0;
      const playerStats = playerStatsBySet.get(set.id) ?? [];
      const complete = hasCompletePlayerStats(playerStats, set.blueTeamId, set.redTeamId);

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
        setStatusMismatches.push({
          setId: set.id,
          matchId: match.id,
          setNumber: set.setNumber,
          before: set.status,
          after: recomputedStatus,
        });
        const key = `${set.status} -> ${recomputedStatus}`;
        setStatusTransitionCounts[key] = (setStatusTransitionCounts[key] ?? 0) + 1;
      }

      if (set.winnerTeamId && set.status === "scheduled") {
        winnerButScheduled.push({
          setId: set.id,
          matchId: match.id,
          setNumber: set.setNumber,
          before: set.status,
          after: recomputedStatus,
        });
      }

      const hasAnyResultData = hasGameStats || complete || pickCount > 0 || banCount > 0;
      if (hasAnyResultData && (set.status === "scheduled" || set.status === "draft_in_progress" || set.status === "draft_done")) {
        hasDataButEarlyStatus.push({
          setId: set.id,
          matchId: match.id,
          setNumber: set.setNumber,
          before: set.status,
          after: recomputedStatus,
        });
      }
    }
  }

  const matchMismatches: MatchScoreMismatch[] = [];
  const matchWinnerOutsideParticipants: DiagnosticMatchRow[] = [];
  const matchSameTeams: DiagnosticMatchRow[] = [];
  const matchesSkippedNoTeams: DiagnosticMatchRow[] = [];

  for (const match of matches) {
    if (match.teamAId && match.teamBId && match.teamAId === match.teamBId) {
      matchSameTeams.push(match);
    }
    if (match.winnerTeamId && match.winnerTeamId !== match.teamAId && match.winnerTeamId !== match.teamBId) {
      matchWinnerOutsideParticipants.push(match);
    }
    if (!match.teamAId || !match.teamBId) {
      matchesSkippedNoTeams.push(match);
      continue;
    }

    const confirmedSets = (setsByMatch.get(match.id) ?? []).filter((set) => set.winnerTeamId != null);
    const next = computeMatchAggregate({
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      bestOf: match.bestOf,
      setResults: confirmedSets.map((set) => ({ winnerTeamId: set.winnerTeamId })),
    });

    const changed =
      (match.teamAScore ?? 0) !== next.teamAScore ||
      (match.teamBScore ?? 0) !== next.teamBScore ||
      match.status !== next.status ||
      match.winnerTeamId !== next.winnerTeamId;

    if (changed) {
      matchMismatches.push({
        matchId: match.id,
        name: match.name,
        before: {
          score: `${match.teamAScore ?? "null"}:${match.teamBScore ?? "null"}`,
          status: match.status,
          winnerTeamId: match.winnerTeamId,
        },
        after: {
          score: `${next.teamAScore}:${next.teamBScore}`,
          status: next.status,
          winnerTeamId: next.winnerTeamId,
        },
      });
    }
  }

  return {
    matchCount: matches.length,
    setCount: sets.length,
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
  };
}
