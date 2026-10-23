import type { Match, PlayerPosition, PlayerStatLine, SetResult, Team, Tournament } from "./types.ts";
import { briefingTeamMetricAt15, matchBriefingSample } from "./match-briefing-stats.ts";

export const LANE_POSITIONS: PlayerPosition[] = ["TOP", "JGL", "MID", "BOT", "SUP"];

export type BriefingSideRecord = { wins: number; games: number };

export type BriefingObjectiveKey = "kills" | "dragons" | "barons" | "towers" | "minutes";

export type BriefingLane = {
  position: PlayerPosition;
  playerId: string;
  /** 15분 골드 격차가 기록된 세트 수. */
  games: number;
  goldDiffAt15: number | null;
};

export type BriefingTeamVisuals = {
  teamId: string;
  sets: number;
  /** 표본 세트 ID. 첫 드래곤과 챔피언 집계가 같은 표본을 쓰도록 넘긴다. */
  setIds: string[];
  blue: BriefingSideRecord;
  red: BriefingSideRecord;
  objectives: Record<BriefingObjectiveKey, number | null>;
  lanes: BriefingLane[];
};

export type LeagueSetRecord = { regionA: string; regionB: string; winsA: number; winsB: number };

function average(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => value != null && Number.isFinite(value));
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
}

function teamVisuals(teamId: string, teamSets: SetResult[], playerStats: PlayerStatLine[]): BriefingTeamVisuals {
  const finished = teamSets.filter((set) => set.winnerTeamId);
  const side = (blue: boolean) => {
    const games = finished.filter((set) => (set.blueTeamId === teamId) === blue);
    return { wins: games.filter((set) => set.winnerTeamId === teamId).length, games: games.length };
  };
  const own = (set: SetResult, blue: number | null | undefined, red: number | null | undefined) =>
    set.blueTeamId === teamId ? blue : red;
  const setIds = new Set(finished.map((set) => set.id));
  const lines = playerStats.filter((line) => line.teamId === teamId && setIds.has(line.setId));
  const lanes = LANE_POSITIONS.flatMap((position) => {
    const byPlayer = new Map<string, PlayerStatLine[]>();
    for (const line of lines.filter((item) => item.position === position)) {
      byPlayer.set(line.playerId, [...(byPlayer.get(line.playerId) ?? []), line]);
    }
    // 같은 포지션에 교체 선수가 있으면 가장 많이 출전한 선수를 대표로 쓴다.
    const [playerId, played] = [...byPlayer.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
    if (!playerId || !played) return [];
    const timeline = played.filter((line) => line.goldDiffAt15 != null);
    return [{ position, playerId, games: timeline.length, goldDiffAt15: average(timeline.map((line) => line.goldDiffAt15)) }];
  });
  return {
    teamId,
    sets: finished.length,
    setIds: finished.map((set) => set.id),
    blue: side(true),
    red: side(false),
    objectives: {
      kills: average(finished.map((set) => own(set, set.blueKills, set.redKills))),
      dragons: average(finished.map((set) => own(set, set.blueDragons, set.redDragons))),
      barons: average(finished.map((set) => own(set, set.blueBarons, set.redBarons))),
      towers: average(finished.map((set) => own(set, set.blueTowers, set.redTowers))),
      minutes: average(finished.map((set) => set.durationSeconds == null ? null : set.durationSeconds / 60)),
    },
    lanes,
  };
}

/** 팀 지표 비교와 같은 최근 세트 표본으로 진영, 운영, 라인 지표를 만든다. */
export function buildMatchBriefingVisuals(match: Match, matches: Match[], sets: SetResult[], playerStats: PlayerStatLine[]) {
  const sample = matchBriefingSample(match, matches, sets);
  const forTeam = (teamId: string) => {
    const ids = new Set((sample.statByTeam.get(teamId) ?? []).map((item) => item.id));
    return teamVisuals(teamId, sample.sets.filter((set) => ids.has(set.matchId) && [set.blueTeamId, set.redTeamId].includes(teamId)), playerStats);
  };
  return { teamA: forTeam(match.teamAId), teamB: forTeam(match.teamBId) };
}

export const TEAM_STYLE_AXES = [
  { label: "초반", title: "15분 골드 격차" },
  { label: "오브젝트", title: "드래곤과 타워 점유율" },
  { label: "후반", title: "바론 점유율" },
  { label: "시야", title: "분당 시야 점수" },
  { label: "운영 속도", title: "승리 경기 평균 시간" },
  { label: "안정성", title: "분당 데스" },
] as const;

export type TeamStyle = { teamId: string; sets: number; values: Array<number | null>; scores: Array<number | null> };

function share(own: number, opponent: number) {
  return own + opponent > 0 ? own / (own + opponent) : null;
}

/**
 * 6축 팀 성향. 수집된 모든 팀의 최근 세트 값을 모집단으로 백분위를 낸다.
 * 운영 속도(승리 경기 시간)와 안정성(분당 데스)은 낮을수록 좋아 순위를 뒤집는다.
 */
export function buildTeamStyles(match: Match, matches: Match[], sets: SetResult[], playerStats: PlayerStatLine[]) {
  const sample = matchBriefingSample(match, matches, sets);
  const linesBySet = new Map<string, PlayerStatLine[]>();
  for (const line of playerStats) {
    const key = `${line.teamId}:${line.setId}`;
    linesBySet.set(key, [...(linesBySet.get(key) ?? []), line]);
  }
  const styles = new Map<string, TeamStyle>();
  for (const [teamId, recent] of sample.statByTeam) {
    const ids = new Set(recent.map((item) => item.id));
    const teamSets = sample.sets.filter((set) => ids.has(set.matchId) && [set.blueTeamId, set.redTeamId].includes(teamId));
    const pair = (set: SetResult, blue: number | null | undefined, red: number | null | undefined) =>
      set.blueTeamId === teamId ? [blue, red] : [red, blue];
    const minutes = (set: SetResult) => set.durationSeconds ? set.durationSeconds / 60 : null;
    const complete = (set: SetResult) => {
      const lines = linesBySet.get(`${teamId}:${set.id}`) ?? [];
      return lines.length === 5 ? lines : null;
    };
    const values = [
      average(teamSets.map((set) => {
        const lines = complete(set);
        return lines && lines.every((line) => line.goldDiffAt15 != null)
          ? lines.reduce((sum, line) => sum + line.goldDiffAt15!, 0)
          : briefingTeamMetricAt15(set, teamId, "goldDiffAt15");
      })),
      average(teamSets.map((set) => {
        const [dragons, opponentDragons] = pair(set, set.blueDragons, set.redDragons);
        const [towers, opponentTowers] = pair(set, set.blueTowers, set.redTowers);
        return dragons == null || opponentDragons == null || towers == null || opponentTowers == null
          ? null
          : share(dragons + towers, opponentDragons + opponentTowers);
      })),
      average(teamSets.map((set) => {
        const [barons, opponentBarons] = pair(set, set.blueBarons, set.redBarons);
        return barons == null || opponentBarons == null ? null : share(barons, opponentBarons);
      })),
      average(teamSets.map((set) => {
        const lines = complete(set);
        const length = minutes(set);
        return lines && length ? lines.reduce((sum, line) => sum + line.visionScore, 0) / length : null;
      })),
      average(teamSets.filter((set) => set.winnerTeamId === teamId).map(minutes)),
      average(teamSets.map((set) => {
        const [, opponentKills] = pair(set, set.blueKills, set.redKills);
        const length = minutes(set);
        return opponentKills == null || !length ? null : opponentKills / length;
      })),
    ];
    styles.set(teamId, { teamId, sets: teamSets.length, values, scores: [] });
  }
  const inverted = new Set([4, 5]);
  for (const style of styles.values()) {
    style.scores = style.values.map((value, index) => {
      const population = [...styles.values()].flatMap((item) => item.values[index] == null ? [] : [item.values[index]!]);
      if (value == null || population.length < 2) return null;
      const better = population.filter((entry) => inverted.has(index) ? entry > value : entry < value).length;
      const equal = population.filter((entry) => entry === value).length;
      return Math.round((better + (equal - 1) / 2) / (population.length - 1) * 100);
    });
  }
  const empty = (teamId: string): TeamStyle => ({
    teamId, sets: 0, values: TEAM_STYLE_AXES.map(() => null), scores: TEAM_STYLE_AXES.map(() => null),
  });
  return { teamA: styles.get(match.teamAId) ?? empty(match.teamAId), teamB: styles.get(match.teamBId) ?? empty(match.teamBId) };
}

export function formatTeamStyle(value: number | null, index: number) {
  if (value == null) return "-";
  if (index === 0) return `${value > 0 ? "+" : ""}${Math.round(value).toLocaleString("ko-KR")}`;
  if (index === 1 || index === 2) return `${Math.round(value * 100)}%`;
  if (index === 3) return value.toFixed(1);
  if (index === 4) return `${Math.floor(value)}:${String(Math.round(value % 1 * 60)).padStart(2, "0")}`;
  return value.toFixed(2);
}

export type ChampionPriority = { championId: string; picksA: number; picksB: number };

/** 두 팀 표본 세트의 챔피언 픽 수. 두 팀 합계가 큰 순서로 limit개를 남긴다. */
export function buildChampionPriority(teams: BriefingTeamVisuals[], playerStats: PlayerStatLine[], limit = 8): ChampionPriority[] {
  const counts = new Map<string, ChampionPriority>();
  teams.forEach((team, index) => {
    const ids = new Set(team.setIds);
    for (const line of playerStats) {
      if (line.teamId !== team.teamId || !ids.has(line.setId) || !line.championId) continue;
      const entry = counts.get(line.championId) ?? { championId: line.championId, picksA: 0, picksB: 0 };
      if (index === 0) entry.picksA += 1;
      else entry.picksB += 1;
      counts.set(line.championId, entry);
    }
  });
  return [...counts.values()].sort((a, b) => b.picksA + b.picksB - (a.picksA + a.picksB)).slice(0, limit);
}

export type DragonEvent = { setId: string; teamId: string | null; timestampMs: number };

/** 프리뷰에 저장한 Leaguepedia 타임라인 시각을 정규 세트 이벤트와 같은 형태로 전달한다. */
export function briefingDragonEvents(sets: SetResult[], sampleSetIds: string[]): DragonEvent[] {
  const ids = new Set(sampleSetIds);
  return sets.filter((set) => ids.has(set.id)).flatMap((set) =>
    [[set.blueTeamId, set.blueFirstDragonAtMs], [set.redTeamId, set.redFirstDragonAtMs]].flatMap(([teamId, timestamp]) =>
      typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp >= 0
        ? [{ setId: set.id, teamId: teamId as string, timestampMs: timestamp }]
        : []));
}

/** 팀이 표본 세트마다 처음 처치한 드래곤 시각(분). 드래곤을 처치하지 못한 세트는 빠진다. */
export function buildFirstDragonMinutes(team: BriefingTeamVisuals, events: DragonEvent[]) {
  const ids = new Set(team.setIds);
  const first = new Map<string, number>();
  for (const event of events) {
    if (event.teamId !== team.teamId || !ids.has(event.setId)) continue;
    first.set(event.setId, Math.min(first.get(event.setId) ?? Infinity, event.timestampMs));
  }
  return [...first.values()].map((ms) => ms / 60_000).sort((a, b) => a - b);
}

export function teamRegion(team: Team | undefined) {
  if (!team) return null;
  return team.isLckTeam ? "Korea" : team.region ?? null;
}

const REGION_LEAGUES: Record<string, string> = {
  Korea: "LCK", China: "LPL", EMEA: "LEC", "North America": "LCS", "Asia Pacific": "LCP",
  Vietnam: "VCS", Brazil: "CBLOL", "Latin America": "LLA", Japan: "LJL",
};

export function regionLeague(region: string) {
  return REGION_LEAGUES[region] ?? region;
}

/** 같은 시즌 국제 대회에서 두 지역 팀이 맞붙은 세트 결과. 경기 시작 전 결과만 센다. */
export function buildLeagueSetRecord({ match, teams, matches, sets, tournaments }: {
  match: Match; teams: Team[]; matches: Match[]; sets: SetResult[]; tournaments: Tournament[];
}): LeagueSetRecord | null {
  const regionA = teamRegion(teams.find((team) => team.id === match.teamAId));
  const regionB = teamRegion(teams.find((team) => team.id === match.teamBId));
  if (!regionA || !regionB || regionA === regionB) return null;
  const season = tournaments.find((item) => item.id === match.tournamentId)?.season ?? new Date(match.matchDate).getUTCFullYear();
  const international = new Set(tournaments.filter((item) => item.category === "international" && item.season === season).map((item) => item.id));
  const cutoff = Date.parse(match.matchDate);
  const regionById = new Map(teams.map((team) => [team.id, teamRegion(team)]));
  const matchIds = new Set(matches.filter((item) => international.has(item.tournamentId) && Date.parse(item.matchDate) < cutoff
    && [regionById.get(item.teamAId), regionById.get(item.teamBId)].sort().join("|") === [regionA, regionB].sort().join("|"))
    .map((item) => item.id));
  let winsA = 0, winsB = 0;
  for (const set of sets) {
    if (!matchIds.has(set.matchId) || !set.winnerTeamId) continue;
    const region = regionById.get(set.winnerTeamId);
    if (region === regionA) winsA += 1;
    else if (region === regionB) winsB += 1;
  }
  return winsA + winsB ? { regionA, regionB, winsA, winsB } : null;
}
