import type { Match, PlayerStatLine, SetResult } from "@/lib/types";

export const TEAM_RADAR_AXES = [
  { label: "KDA", title: "KDA", decimals: 2, signed: false },
  { label: "DPM", title: "분당 피해량", decimals: 0, signed: false },
  { label: "VS", title: "평균 시야 점수", decimals: 1, signed: false },
  { label: "CSM", title: "분당 CS", decimals: 1, signed: false },
  { label: "GD10", title: "10분 골드차", decimals: 0, signed: true },
  { label: "XPD10", title: "10분 경험치차", decimals: 0, signed: true },
  { label: "GD15", title: "15분 골드차", decimals: 0, signed: true },
  { label: "XPD15", title: "15분 경험치차", decimals: 0, signed: true },
] as const;

export function matchBriefingSample(match: Match, matches: Match[], sets: SetResult[]) {
  const cutoff = new Date(match.matchDate).getTime();
  const previous = matches.filter((item) => item.id !== match.id && item.status === "completed" && item.winnerTeamId && new Date(item.matchDate).getTime() < cutoff)
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
  const byTeam = new Map<string, Match[]>();
  for (const item of previous) {
    for (const teamId of [item.teamAId, item.teamBId]) {
      const recent = byTeam.get(teamId) ?? [];
      if (recent.length < 5) recent.push(item);
      byTeam.set(teamId, recent);
    }
  }
  const matchIds = new Set([...byTeam.values()].flat().map((item) => item.id));
  const completedSets = sets.filter((set) => matchIds.has(set.matchId) && set.winnerTeamId);
  return { byTeam, sets: completedSets, setIds: completedSets.map((set) => set.id) };
}

function mean(values: Array<number | null>) {
  const present = values.filter((value): value is number => value != null && Number.isFinite(value));
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
}

function completeSum(lines: PlayerStatLine[], metric: (line: PlayerStatLine) => number | null | undefined) {
  const values = lines.map(metric);
  return values.every((value) => value != null && Number.isFinite(value))
    ? (values as number[]).reduce((sum, value) => sum + value, 0)
    : null;
}

export type BriefingTeamStats = {
  teamId: string;
  wins: number;
  losses: number;
  form: Array<"W" | "L">;
  setWinRate: number | null;
  statSetCount: number;
  values: Array<number | null>;
  scores: Array<number | null>;
};

export function buildMatchBriefingStats(match: Match, matches: Match[], sets: SetResult[], playerStats: PlayerStatLine[]) {
  const sample = matchBriefingSample(match, matches, sets);
  const linesByTeamSet = new Map<string, PlayerStatLine[]>();
  for (const line of playerStats) {
    const key = `${line.teamId}:${line.setId}`;
    const lines = linesByTeamSet.get(key) ?? [];
    lines.push(line);
    linesByTeamSet.set(key, lines);
  }
  const teams = new Map<string, BriefingTeamStats>();
  for (const teamId of new Set([...sample.byTeam.keys(), match.teamAId, match.teamBId])) {
    const recent = sample.byTeam.get(teamId) ?? [];
    const ids = new Set(recent.map((item) => item.id));
    const teamSets = sample.sets.filter((set) => ids.has(set.matchId) && [set.blueTeamId, set.redTeamId].includes(teamId));
    // 합계 지표에 일부 선수만 섞이지 않도록 완전한 5인 기록만 집계한다.
    const games = teamSets.map((set) => linesByTeamSet.get(`${teamId}:${set.id}`) ?? [])
      .filter((lines) => lines.length === 5 && new Set(lines.map((line) => line.playerId)).size === 5 && new Set(lines.map((line) => line.position)).size === 5);
    const all = games.flat();
    const kills = completeSum(all, (line) => line.kills);
    const deaths = completeSum(all, (line) => line.deaths);
    const assists = completeSum(all, (line) => line.assists);
    const kda = all.length && kills != null && deaths != null && assists != null ? (kills + assists) / Math.max(deaths, 1) : null;
    const perMinute = (line: PlayerStatLine, stored: number | null | undefined, total: number) => stored ?? (line.gameMinutes > 0 ? total / line.gameMinutes : null);
    const values = [
      kda,
      mean(games.map((lines) => completeSum(lines, (line) => perMinute(line, line.dpm, line.damageToChampions)))),
      mean(games.map((lines) => completeSum(lines, (line) => line.visionScore))),
      mean(games.map((lines) => completeSum(lines, (line) => perMinute(line, line.csPerMinute, line.cs)))),
      ...(["goldDiffAt10", "xpDiffAt10", "goldDiffAt15", "xpDiffAt15"] as const).map((key) => mean(games.map((lines) => completeSum(lines, (line) => line[key])))),
    ];
    const scored = recent.filter((item) => item.teamAScore != null && item.teamBScore != null);
    const setWins = scored.reduce((sum, item) => sum + (item.teamAId === teamId ? item.teamAScore! : item.teamBScore!), 0);
    const setLosses = scored.reduce((sum, item) => sum + (item.teamAId === teamId ? item.teamBScore! : item.teamAScore!), 0);
    const wins = recent.filter((item) => item.winnerTeamId === teamId).length;
    teams.set(teamId, {
      teamId, wins, losses: recent.length - wins,
      form: recent.toReversed().map((item) => item.winnerTeamId === teamId ? "W" : "L"),
      setWinRate: setWins + setLosses > 0 ? Math.round(setWins / (setWins + setLosses) * 100) : null,
      statSetCount: games.length, values, scores: [],
    });
  }
  // 두 참가 팀만으로 축을 늘리지 않고, 수집된 모든 팀의 최근 5매치를 공통 모집단으로 쓴다.
  for (const team of teams.values()) {
    team.scores = team.values.map((value, index) => {
      const population = [...teams.values()].flatMap((item) => item.values[index] == null ? [] : [item.values[index]!]);
      if (value == null || population.length < 2) return null;
      const below = population.filter((entry) => entry < value).length;
      const equal = population.filter((entry) => entry === value).length;
      return Math.round((below + (equal - 1) / 2) / (population.length - 1) * 100);
    });
  }
  return { teamA: teams.get(match.teamAId)!, teamB: teams.get(match.teamBId)! };
}

export function formatTeamMetric(value: number | null, index: number) {
  if (value == null) return "-";
  const axis = TEAM_RADAR_AXES[index];
  const formatted = value.toLocaleString("ko-KR", { minimumFractionDigits: axis.decimals, maximumFractionDigits: axis.decimals });
  return axis.signed && value > 0 ? `+${formatted}` : formatted;
}
