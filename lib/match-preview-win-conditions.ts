import type { MatchPreviewFacts, MatchPreviewPlayerFacts } from "./match-preview-facts.ts";

export type MatchPreviewWinConditionAxis =
  | "economy"
  | "objectives"
  | "laning"
  | "damage"
  | "resilience";

export type MatchPreviewWinConditionCandidate = {
  id: string;
  axis: MatchPreviewWinConditionAxis;
  evidenceIds: string[];
  score: number;
  sentence: string;
};

type CandidateGroups = {
  teamA: MatchPreviewWinConditionCandidate[];
  teamB: MatchPreviewWinConditionCandidate[];
};

function signed(value: number) {
  return value > 0 ? `+${value.toLocaleString("ko-KR")}` : value.toLocaleString("ko-KR");
}

function withTopicParticle(value: string) {
  const last = value.codePointAt(value.length - 1) ?? 0;
  const hasHangulFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${value}${hasHangulFinal ? "은" : "는"}`;
}

function playerForSide(player: MatchPreviewPlayerFacts | null, opponent: MatchPreviewPlayerFacts | null) {
  if (!player || player.games < 1) return null;
  const laneEdge = player.goldDiffAt15 === null
    ? null
    : player.goldDiffAt15 - (opponent?.goldDiffAt15 ?? 0);
  const damageEdge = player.dpm === null ? null : player.dpm - (opponent?.dpm ?? 0);
  return { player, laneEdge, damageEdge };
}

function candidatesForSide(
  facts: MatchPreviewFacts,
  side: "teamA" | "teamB",
): MatchPreviewWinConditionCandidate[] {
  const own = facts[side];
  const opponent = side === "teamA" ? facts.teamB : facts.teamA;
  const prefix = side === "teamA" ? "team-a" : "team-b";
  const candidates: MatchPreviewWinConditionCandidate[] = [];

  if (own.averageGoldDiff !== null) {
    const relative = own.averageGoldDiff - (opponent.averageGoldDiff ?? 0);
    candidates.push({
      id: `${prefix}-economy`,
      axis: "economy",
      evidenceIds: [`${prefix}-series`],
      score: relative / 1_000,
      sentence: own.averageGoldDiff >= 0
        ? `${withTopicParticle(own.team)} 최근 세트 평균 골드 차이 ${signed(own.averageGoldDiff)}의 우위를 초중반 포탑과 오브젝트로 확정해야 한다.`
        : `${withTopicParticle(own.team)} 최근 세트 평균 골드 차이 ${signed(own.averageGoldDiff)}의 열세를 키우지 않고 첫 오브젝트 교환으로 중반 진입점을 만들어야 한다.`,
    });
  }

  const objectives = [
    { label: "드래곤", own: own.averageDragons, opponent: opponent.averageDragons, weight: 0.8 },
    { label: "바론", own: own.averageBarons, opponent: opponent.averageBarons, weight: 1.2 },
    { label: "타워", own: own.averageTowers, opponent: opponent.averageTowers, weight: 0.25 },
  ].filter((item): item is { label: string; own: number; opponent: number | null; weight: number } =>
    item.own !== null,
  ).sort((left, right) =>
    Math.abs((right.own - (right.opponent ?? 0)) * right.weight) -
    Math.abs((left.own - (left.opponent ?? 0)) * left.weight),
  );
  const objective = objectives[0];
  if (objective) {
    const relative = objective.own - (objective.opponent ?? 0);
    candidates.push({
      id: `${prefix}-objectives`,
      axis: "objectives",
      evidenceIds: ["team-a-objectives", "team-b-objectives"],
      score: relative * objective.weight,
      sentence: relative >= 0
        ? `${withTopicParticle(own.team)} 세트 평균 ${objective.label} ${objective.own}개의 강점을 살려 첫 ${objective.label} 주도권을 연속 오브젝트로 연결해야 한다.`
        : `${withTopicParticle(own.team)} 상대가 앞서는 ${objective.label} 주도권을 초반부터 견제해 오브젝트 연쇄 손실을 막아야 한다.`,
    });
  }

  const sideKey = side === "teamA" ? "teamA" : "teamB";
  const opponentKey = side === "teamA" ? "teamB" : "teamA";
  const playerEdges = facts.roleMatchups.flatMap((matchup) => {
    const edge = playerForSide(matchup[sideKey], matchup[opponentKey]);
    return edge ? [{ ...edge, position: matchup.position }] : [];
  });
  const lane = playerEdges
    .filter((item) => item.laneEdge !== null && item.player.goldDiffAt15 !== null)
    .sort((left, right) => (right.laneEdge ?? -Infinity) - (left.laneEdge ?? -Infinity))[0];
  if (lane && lane.player.goldDiffAt15 !== null && lane.laneEdge !== null) {
    candidates.push({
      id: `${prefix}-laning`,
      axis: "laning",
      evidenceIds: [`role-${lane.position.toLowerCase()}`],
      score: lane.laneEdge / 500,
      sentence: `${withTopicParticle(own.team)} ${lane.player.player}의 15분 골드 차이 ${signed(lane.player.goldDiffAt15)}를 기준점으로 라인 주도권을 첫 오브젝트 선점까지 이어가야 한다.`,
    });
  }

  const damage = playerEdges
    .filter((item) => item.damageEdge !== null && item.player.dpm !== null)
    .sort((left, right) => (right.damageEdge ?? -Infinity) - (left.damageEdge ?? -Infinity))[0];
  if (damage && damage.player.dpm !== null && damage.damageEdge !== null) {
    candidates.push({
      id: `${prefix}-damage`,
      axis: "damage",
      evidenceIds: [`role-${damage.position.toLowerCase()}`],
      score: damage.damageEdge / 150,
      sentence: `${withTopicParticle(own.team)} DPM ${damage.player.dpm}의 ${damage.player.player} 화력을 한타 선공권과 주요 오브젝트 전환으로 연결해야 한다.`,
    });
  }

  candidates.push({
    id: `${prefix}-resilience`,
    axis: "resilience",
    evidenceIds: [`${prefix}-recent`],
    score: own.closeWins - opponent.closeWins,
    sentence: own.closeWins > 0
      ? `${withTopicParticle(own.team)} 최근 접전승 ${own.closeWins}회의 마무리 경험을 살려 후반 핵심 교전에서 먼저 수적 우위를 만들어야 한다.`
      : `${withTopicParticle(own.team)} 최근 ${own.recentRecord} 흐름에서 반복된 손실을 줄이고 첫 교전 승리를 안정적인 세트 운영으로 연결해야 한다.`,
  });

  return candidates.sort((left, right) => right.score - left.score);
}

export function buildMatchPreviewWinConditionCandidates(facts: MatchPreviewFacts): CandidateGroups {
  return {
    teamA: candidatesForSide(facts, "teamA"),
    teamB: candidatesForSide(facts, "teamB"),
  };
}

function selectedCandidate(
  candidates: MatchPreviewWinConditionCandidate[],
  requestedId: unknown,
) {
  return candidates.find((candidate) => candidate.id === requestedId) ?? candidates[0];
}

export function resolveMatchPreviewWinConditions({
  candidates,
  teamACandidateId,
  teamBCandidateId,
  teamAText,
  teamBText,
}: {
  candidates: CandidateGroups;
  teamACandidateId: unknown;
  teamBCandidateId: unknown;
  teamAText: string | null;
  teamBText: string | null;
}) {
  let teamA = selectedCandidate(candidates.teamA, teamACandidateId);
  let teamB = selectedCandidate(candidates.teamB, teamBCandidateId);
  let useWriterA = teamA?.id === teamACandidateId && Boolean(teamAText);
  let useWriterB = teamB?.id === teamBCandidateId && Boolean(teamBText);

  if (teamA && teamB && teamA.axis === teamB.axis) {
    if (teamA.score >= teamB.score) {
      teamB = candidates.teamB.find((candidate) => candidate.axis !== teamA?.axis) ?? teamB;
      useWriterB = false;
    } else {
      teamA = candidates.teamA.find((candidate) => candidate.axis !== teamB?.axis) ?? teamA;
      useWriterA = false;
    }
  }

  return {
    teamA: teamA ? (useWriterA ? teamAText : teamA.sentence) : teamAText,
    teamB: teamB ? (useWriterB ? teamBText : teamB.sentence) : teamBText,
    evidenceIds: [...new Set([...(teamA?.evidenceIds ?? []), ...(teamB?.evidenceIds ?? [])])],
    axes: { teamA: teamA?.axis ?? null, teamB: teamB?.axis ?? null },
  };
}
