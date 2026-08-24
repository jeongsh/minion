import type { Match, Player, Team } from "@/lib/types";

/**
 * LCK컵의 "Week" 스테이지는 개별 브래킷이 아니라 10팀을 두 조로 나눠 서로 다른 조끼리만
 * 붙는 크로스 그룹 스테이지다. 명시적인 조 데이터가 없어서, 매치 상대 관계로부터 이분
 * 그래프 2색칠을 통해 조를 복원한다(깔끔히 두 그룹으로 안 나뉘면 null을 반환해 표시를
 * 건너뛴다).
 */
export function deriveCrossGroups(matches: Match[]): Map<string, 0 | 1> | null {
  const opponents = new Map<string, Set<string>>();
  const teamIds = new Set<string>();

  for (const match of matches) {
    teamIds.add(match.teamAId);
    teamIds.add(match.teamBId);
    if (!opponents.has(match.teamAId)) opponents.set(match.teamAId, new Set());
    if (!opponents.has(match.teamBId)) opponents.set(match.teamBId, new Set());
    opponents.get(match.teamAId)!.add(match.teamBId);
    opponents.get(match.teamBId)!.add(match.teamAId);
  }

  const color = new Map<string, 0 | 1>();

  for (const teamId of teamIds) {
    if (color.has(teamId)) continue;

    color.set(teamId, 0);
    const queue = [teamId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentColor = color.get(current)!;
      const nextColor: 0 | 1 = currentColor === 0 ? 1 : 0;

      for (const opponent of opponents.get(current) ?? []) {
        if (!color.has(opponent)) {
          color.set(opponent, nextColor);
          queue.push(opponent);
        } else if (color.get(opponent) !== nextColor) {
          return null;
        }
      }
    }
  }

  return color;
}

/**
 * 일부 시즌의 정규시즌 후반(예: 2025 Rounds 3-5)은 크로스 그룹이 아니라 같은 조끼리만
 * 맞붙는 방식으로 진행된다. 이 경우 매치 상대 관계 그래프는 조별로 서로 연결되지 않은
 * 컴포넌트 2개로 쪼개진다. 정확히 2개로 나뉘지 않으면(조 구분이 없거나 다른 형식이면)
 * null을 반환해 표시를 건너뛴다.
 */
export function deriveMatchGroups(matches: Match[]): Map<string, 0 | 1> | null {
  const adjacency = new Map<string, Set<string>>();
  const teamIds = new Set<string>();

  for (const match of matches) {
    teamIds.add(match.teamAId);
    teamIds.add(match.teamBId);
    if (!adjacency.has(match.teamAId)) adjacency.set(match.teamAId, new Set());
    if (!adjacency.has(match.teamBId)) adjacency.set(match.teamBId, new Set());
    adjacency.get(match.teamAId)!.add(match.teamBId);
    adjacency.get(match.teamBId)!.add(match.teamAId);
  }

  const componentOf = new Map<string, number>();
  let componentCount = 0;

  for (const teamId of teamIds) {
    if (componentOf.has(teamId)) continue;

    componentOf.set(teamId, componentCount);
    const queue = [teamId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!componentOf.has(neighbor)) {
          componentOf.set(neighbor, componentCount);
          queue.push(neighbor);
        }
      }
    }

    componentCount += 1;
  }

  if (componentCount !== 2) return null;

  const color = new Map<string, 0 | 1>();
  for (const [teamId, component] of componentOf) {
    color.set(teamId, component === 0 ? 0 : 1);
  }
  return color;
}

export type PomRow = { rank: number; player: Player; team?: Team; count: number; points: number };

// POM 1회당 100점(네이버 e스포츠 LCK 선수 기록 페이지와 동일한 산정 방식).
export const POM_POINTS_PER_AWARD = 100;

export function buildPomRankingRows(segmentMatches: Match[], players: Player[], teamMap: Map<string, Team>): PomRow[] {
  const counts = new Map<string, number>();
  for (const match of segmentMatches) {
    if (!match.officialPomPlayerId) continue;
    counts.set(match.officialPomPlayerId, (counts.get(match.officialPomPlayerId) ?? 0) + 1);
  }

  const unranked: Array<{ player: Player; team?: Team; count: number; points: number }> = [];
  for (const [playerId, count] of counts) {
    const player = players.find((item) => item.id === playerId);
    if (player) unranked.push({ player, team: teamMap.get(player.teamId), count, points: count * POM_POINTS_PER_AWARD });
  }

  return unranked
    .sort((a, b) => b.count - a.count)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

// LCK는 스플릿 1(LCK컵) / 스플릿 2(MSI로 가는 길) / 스플릿 3(롤드컵으로 가는 길)로 구성된다.
export const LCK_SPLIT_LABELS = { "1": "스플릿 1", "2": "스플릿 2", "3": "스플릿 3" } as const;
export type LckSplitKey = keyof typeof LCK_SPLIT_LABELS;

export const LCK_SPLIT_VIEW_LABELS: Record<LckSplitKey, { standings: string; bracket: string }> = {
  "1": { standings: "크로스 그룹 스테이지", bracket: "토너먼트" },
  "2": { standings: "정규리그", bracket: "MSI로 가는 길" },
  "3": { standings: "정규리그", bracket: "토너먼트" },
};
