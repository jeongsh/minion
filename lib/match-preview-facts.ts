import type {
  Match,
  Player,
  PlayerPosition,
  PlayerStatLine,
  SetResult,
  Team,
  Tournament,
} from "@/lib/types";

const INITIAL_ELO = 1500;
const ELO_K = 28;
const RECENT_MATCH_LIMIT = 5;

type RecentSeriesFact = {
  opponent: string;
  opponentRating: number;
  result: "W" | "L";
  score: string;
};

export type MatchPreviewTeamFacts = {
  team: string;
  rating: number;
  recentRecord: string;
  setRecord: string;
  averageOpponentRating: number | null;
  cleanWins: number;
  closeWins: number;
  averageGameMinutes: number | null;
  averageKills: number | null;
  averageGoldDiff: number | null;
  averageDragons: number | null;
  averageBarons: number | null;
  averageTowers: number | null;
  statSetCount: number;
  recentSeries: RecentSeriesFact[];
};

export type MatchPreviewPlayerFacts = {
  player: string;
  position: PlayerPosition;
  games: number;
  kda: number | null;
  dpm: number | null;
  damageShare: number | null;
  goldDiffAt15: number | null;
  xpDiffAt15: number | null;
  csDiffAt15: number | null;
};

export type MatchPreviewFacts = {
  matchId: string;
  matchup: string;
  firstMeeting: boolean;
  priorMeetings: number;
  teamA: MatchPreviewTeamFacts;
  teamB: MatchPreviewTeamFacts;
  commonOpponents: Array<{
    opponent: string;
    teamAResult: string;
    teamBResult: string;
  }>;
  roleMatchups: Array<{
    position: PlayerPosition;
    teamA: MatchPreviewPlayerFacts | null;
    teamB: MatchPreviewPlayerFacts | null;
  }>;
};

function teamName(teams: Team[], teamId: string) {
  const team = teams.find((item) => item.id === teamId);
  return team?.shortName || team?.name || "TBD";
}

function isCompletedBefore(match: Match, currentTime: number) {
  return (
    match.status === "completed" &&
    Boolean(match.teamAId) &&
    Boolean(match.teamBId) &&
    Boolean(match.winnerTeamId) &&
    new Date(match.matchDate).getTime() < currentTime
  );
}

function isSamePair(match: Match, teamAId: string, teamBId: string) {
  return (
    (match.teamAId === teamAId && match.teamBId === teamBId) ||
    (match.teamAId === teamBId && match.teamBId === teamAId)
  );
}

function scoreForTeam(match: Match, teamId: string) {
  const own = match.teamAId === teamId ? match.teamAScore : match.teamBScore;
  const opponent = match.teamAId === teamId ? match.teamBScore : match.teamAScore;
  return { own: own ?? 0, opponent: opponent ?? 0 };
}

function opponentId(match: Match, teamId: string) {
  return match.teamAId === teamId ? match.teamBId : match.teamAId;
}

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nullableRoundedAverage(values: Array<number | null | undefined>, digits = 1) {
  const present = values.filter((value): value is number => value !== null && value !== undefined);
  const value = average(present);
  return value === null ? null : round(value, digits);
}

function buildEloHistory(matches: Match[]) {
  const ratings = new Map<string, number>();
  const preMatchRatings = new Map<string, { teamA: number; teamB: number }>();

  for (const match of [...matches].sort(
    (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
  )) {
    const teamARating = ratings.get(match.teamAId) ?? INITIAL_ELO;
    const teamBRating = ratings.get(match.teamBId) ?? INITIAL_ELO;
    preMatchRatings.set(match.id, { teamA: teamARating, teamB: teamBRating });

    const expectedA = 1 / (1 + 10 ** ((teamBRating - teamARating) / 400));
    const actualA = match.winnerTeamId === match.teamAId ? 1 : 0;
    const delta = ELO_K * (actualA - expectedA);
    ratings.set(match.teamAId, teamARating + delta);
    ratings.set(match.teamBId, teamBRating - delta);
  }

  return { ratings, preMatchRatings };
}

function setMetric(
  set: SetResult,
  teamId: string,
  blueValue: number | null | undefined,
  redValue: number | null | undefined,
) {
  return set.blueTeamId === teamId ? blueValue : redValue;
}

function opposingSetMetric(
  set: SetResult,
  teamId: string,
  blueValue: number | null | undefined,
  redValue: number | null | undefined,
) {
  return set.blueTeamId === teamId ? redValue : blueValue;
}

function teamFacts({
  teamId,
  teams,
  previousMatches,
  sets,
  ratings,
  preMatchRatings,
}: {
  teamId: string;
  teams: Team[];
  previousMatches: Match[];
  sets: SetResult[];
  ratings: Map<string, number>;
  preMatchRatings: Map<string, { teamA: number; teamB: number }>;
}): MatchPreviewTeamFacts {
  const recentMatches = previousMatches
    .filter((item) => item.teamAId === teamId || item.teamBId === teamId)
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())
    .slice(0, RECENT_MATCH_LIMIT);
  const recentMatchIds = new Set(recentMatches.map((item) => item.id));
  const recentSets = sets.filter(
    (set) =>
      recentMatchIds.has(set.matchId) &&
      (set.blueTeamId === teamId || set.redTeamId === teamId) &&
      Boolean(set.winnerTeamId),
  );
  const wins = recentMatches.filter((item) => item.winnerTeamId === teamId).length;
  const setScore = recentMatches.reduce(
    (total, item) => {
      const score = scoreForTeam(item, teamId);
      total.wins += score.own;
      total.losses += score.opponent;
      return total;
    },
    { wins: 0, losses: 0 },
  );
  const opponentRatings = recentMatches.map((item) => {
    const snapshot = preMatchRatings.get(item.id);
    return item.teamAId === teamId ? snapshot?.teamB : snapshot?.teamA;
  }).filter((value): value is number => value !== undefined);

  const metricValues = (selector: (set: SetResult) => number | null | undefined) =>
    recentSets.map(selector).filter((value): value is number => value !== null && value !== undefined);
  const goldDiffs = recentSets.map((set) => {
    const own = setMetric(set, teamId, set.blueGold, set.redGold);
    const opponent = opposingSetMetric(set, teamId, set.blueGold, set.redGold);
    return own === null || own === undefined || opponent === null || opponent === undefined
      ? null
      : own - opponent;
  }).filter((value): value is number => value !== null);

  return {
    team: teamName(teams, teamId),
    rating: Math.round(ratings.get(teamId) ?? INITIAL_ELO),
    recentRecord: `${wins}승 ${recentMatches.length - wins}패`,
    setRecord: recentMatches.length > 0 ? `${setScore.wins}승 ${setScore.losses}패` : "데이터 없음",
    averageOpponentRating: average(opponentRatings) === null ? null : Math.round(average(opponentRatings)!),
    cleanWins: recentMatches.filter((item) => {
      const score = scoreForTeam(item, teamId);
      return item.winnerTeamId === teamId && score.opponent === 0;
    }).length,
    closeWins: recentMatches.filter((item) => {
      const score = scoreForTeam(item, teamId);
      return item.winnerTeamId === teamId && score.own - score.opponent === 1;
    }).length,
    averageGameMinutes: average(metricValues((set) => set.durationSeconds)) === null
      ? null
      : round(average(metricValues((set) => set.durationSeconds))! / 60),
    averageKills: average(metricValues((set) => setMetric(set, teamId, set.blueKills, set.redKills))) === null
      ? null
      : round(average(metricValues((set) => setMetric(set, teamId, set.blueKills, set.redKills)))!),
    averageGoldDiff: average(goldDiffs) === null ? null : Math.round(average(goldDiffs)!),
    averageDragons: average(metricValues((set) => setMetric(set, teamId, set.blueDragons, set.redDragons))) === null
      ? null
      : round(average(metricValues((set) => setMetric(set, teamId, set.blueDragons, set.redDragons)))!),
    averageBarons: average(metricValues((set) => setMetric(set, teamId, set.blueBarons, set.redBarons))) === null
      ? null
      : round(average(metricValues((set) => setMetric(set, teamId, set.blueBarons, set.redBarons)))!),
    averageTowers: average(metricValues((set) => setMetric(set, teamId, set.blueTowers, set.redTowers))) === null
      ? null
      : round(average(metricValues((set) => setMetric(set, teamId, set.blueTowers, set.redTowers)))!),
    statSetCount: recentSets.length,
    recentSeries: recentMatches.map((item) => {
      const opponent = opponentId(item, teamId);
      const snapshot = preMatchRatings.get(item.id);
      const opponentRating = item.teamAId === teamId ? snapshot?.teamB : snapshot?.teamA;
      const score = scoreForTeam(item, teamId);
      return {
        opponent: teamName(teams, opponent),
        opponentRating: Math.round(opponentRating ?? INITIAL_ELO),
        result: item.winnerTeamId === teamId ? "W" : "L",
        score: `${score.own}:${score.opponent}`,
      };
    }),
  };
}

function latestResultAgainst(matches: Match[], teamId: string, opponent: string) {
  const match = matches.find(
    (item) =>
      (item.teamAId === teamId && item.teamBId === opponent) ||
      (item.teamBId === teamId && item.teamAId === opponent),
  );
  if (!match) return "데이터 없음";
  const score = scoreForTeam(match, teamId);
  return `${match.winnerTeamId === teamId ? "승" : "패"} ${score.own}:${score.opponent}`;
}

function isKespaCup(tournament: Tournament | undefined) {
  if (!tournament) return false;
  const identity = [
    tournament.name,
    tournament.league,
    tournament.split,
    tournament.sourceTournamentId,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "");
  return identity.includes("kespa") || identity.includes("케스파");
}

function recentSetIdsForTeam(matches: Match[], sets: SetResult[], teamId: string) {
  const matchIds = new Set(matches.slice(0, RECENT_MATCH_LIMIT).map((match) => match.id));
  return new Set(
    sets
      .filter(
        (set) =>
          matchIds.has(set.matchId) &&
          (set.blueTeamId === teamId || set.redTeamId === teamId),
      )
      .map((set) => set.id),
  );
}

function playerFacts({
  teamId,
  position,
  recentSetIds,
  players,
  playerStats,
}: {
  teamId: string;
  position: PlayerPosition;
  recentSetIds: Set<string>;
  players: Player[];
  playerStats: PlayerStatLine[];
}): MatchPreviewPlayerFacts | null {
  const rosterCandidates = players.filter(
    (player) =>
      player.teamId === teamId &&
      player.position === position &&
      player.isActive !== false &&
      player.isLckPlayer !== false &&
      player.importedScope !== "challengers",
  );
  const rosterIds = new Set(rosterCandidates.map((player) => player.id));
  const positionLines = playerStats.filter(
    (line) =>
      line.teamId === teamId &&
      line.position === position &&
      recentSetIds.has(line.setId) &&
      rosterIds.has(line.playerId),
  );
  const gamesByPlayer = new Map<string, number>();
  for (const line of positionLines) {
    gamesByPlayer.set(line.playerId, (gamesByPlayer.get(line.playerId) ?? 0) + 1);
  }
  const playerId =
    [...gamesByPlayer.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
    rosterCandidates.find((player) => player.isStarter)?.id ??
    rosterCandidates[0]?.id;
  if (!playerId) return null;

  const player = players.find((item) => item.id === playerId);
  const lines = positionLines.filter((line) => line.playerId === playerId);
  const kills = lines.reduce((sum, line) => sum + line.kills, 0);
  const deaths = lines.reduce((sum, line) => sum + line.deaths, 0);
  const assists = lines.reduce((sum, line) => sum + line.assists, 0);

  return {
    player: player?.name ?? playerId,
    position,
    games: lines.length,
    kda: lines.length > 0 ? round((kills + assists) / Math.max(deaths, 1), 2) : null,
    dpm: nullableRoundedAverage(
      lines.map((line) =>
        line.dpm ??
        (line.gameMinutes > 0 ? line.damageToChampions / line.gameMinutes : null),
      ),
    ),
    damageShare: nullableRoundedAverage(lines.map((line) => line.damageShare), 3),
    goldDiffAt15: nullableRoundedAverage(lines.map((line) => line.goldDiffAt15)),
    xpDiffAt15: nullableRoundedAverage(lines.map((line) => line.xpDiffAt15)),
    csDiffAt15: nullableRoundedAverage(lines.map((line) => line.csDiffAt15)),
  };
}

export function buildMatchPreviewFacts({
  match,
  teams,
  matches,
  sets,
  tournaments = [],
  players = [],
  playerStats = [],
}: {
  match: Match;
  teams: Team[];
  matches: Match[];
  sets: SetResult[];
  tournaments?: Tournament[];
  players?: Player[];
  playerStats?: PlayerStatLine[];
}): MatchPreviewFacts {
  const currentTime = new Date(match.matchDate).getTime();
  const kespaTournamentIds = new Set(
    tournaments.filter((tournament) => isKespaCup(tournament)).map((tournament) => tournament.id),
  );
  const previousMatches = matches.filter(
    (item) =>
      isCompletedBefore(item, currentTime) && !kespaTournamentIds.has(item.tournamentId),
  );
  const { ratings, preMatchRatings } = buildEloHistory(previousMatches);
  const teamAMatches = previousMatches
    .filter((item) => item.teamAId === match.teamAId || item.teamBId === match.teamAId)
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
  const teamBMatches = previousMatches
    .filter((item) => item.teamAId === match.teamBId || item.teamBId === match.teamBId)
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
  const teamARecentOpponents = new Set(
    teamAMatches.slice(0, RECENT_MATCH_LIMIT).map((item) => opponentId(item, match.teamAId)),
  );
  const teamBRecentOpponents = new Set(
    teamBMatches.slice(0, RECENT_MATCH_LIMIT).map((item) => opponentId(item, match.teamBId)),
  );
  const commonOpponentIds = [...teamARecentOpponents].filter((id) => teamBRecentOpponents.has(id));
  const priorMeetings = previousMatches.filter((item) =>
    isSamePair(item, match.teamAId, match.teamBId),
  ).length;
  const teamARecentSetIds = recentSetIdsForTeam(teamAMatches, sets, match.teamAId);
  const teamBRecentSetIds = recentSetIdsForTeam(teamBMatches, sets, match.teamBId);
  const positions: PlayerPosition[] = ["TOP", "JGL", "MID", "BOT", "SUP"];

  return {
    matchId: match.id,
    matchup: `${teamName(teams, match.teamAId)} vs ${teamName(teams, match.teamBId)}`,
    firstMeeting: priorMeetings === 0,
    priorMeetings,
    teamA: teamFacts({
      teamId: match.teamAId,
      teams,
      previousMatches,
      sets,
      ratings,
      preMatchRatings,
    }),
    teamB: teamFacts({
      teamId: match.teamBId,
      teams,
      previousMatches,
      sets,
      ratings,
      preMatchRatings,
    }),
    commonOpponents: commonOpponentIds.slice(0, 3).map((opponent) => ({
      opponent: teamName(teams, opponent),
      teamAResult: latestResultAgainst(teamAMatches, match.teamAId, opponent),
      teamBResult: latestResultAgainst(teamBMatches, match.teamBId, opponent),
    })),
    roleMatchups: positions.map((position) => ({
      position,
      teamA: playerFacts({
        teamId: match.teamAId,
        position,
        recentSetIds: teamARecentSetIds,
        players,
        playerStats,
      }),
      teamB: playerFacts({
        teamId: match.teamBId,
        position,
        recentSetIds: teamBRecentSetIds,
        players,
        playerStats,
      }),
    })),
  };
}
