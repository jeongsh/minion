import { calculatePlayerStats } from "@/lib/stats";
import type {
  CommunityPost,
  FanRating,
  Match,
  Player,
  PlayerStatLine,
  SetResult,
  Team,
} from "@/lib/types";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function findTeam(teams: Team[], teamId: string | null | undefined) {
  return teams.find((team) => team.id === teamId);
}

export function findPlayer(players: Player[], playerId: string | null | undefined) {
  return players.find((player) => player.id === playerId);
}

export function teamLabel(teams: Team[], teamId: string | null | undefined) {
  return findTeam(teams, teamId)?.shortName ?? "-";
}

export function playerLabel(players: Player[], playerId: string | null | undefined) {
  return findPlayer(players, playerId)?.name ?? "-";
}

export function durationLabel(seconds: number | null | undefined) {
  if (!seconds) {
    return "-";
  }

  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

export function matchSetScore(match: Match, sets: SetResult[], teams: Team[]) {
  const relatedSets = sets.filter((set) => set.matchId === match.id);

  if (relatedSets.length === 0) {
    return "-";
  }

  return relatedSets
    .map((set) => `${set.setNumber}세트 ${teamLabel(teams, set.winnerTeamId)}`)
    .join(" / ");
}

export function topFanRatingForMatch(
  matchId: string,
  fanRatings: FanRating[],
  players: Player[],
) {
  const rating = fanRatings
    .filter((item) => item.matchId === matchId)
    .sort((a, b) => b.rating - a.rating)[0];

  if (!rating) {
    return "-";
  }

  return `${playerLabel(players, rating.playerId)} ${rating.rating.toFixed(1)}`;
}

export function fanPogSummaryForMatch(matchId: string, sets: SetResult[]) {
  const relatedSets = sets.filter((set) => set.matchId === matchId);

  if (relatedSets.length === 0) {
    return "-";
  }

  return relatedSets.map((set) => `${set.setNumber}세트 집계 예정`).join(" / ");
}

export function buildTeamStandingRows(
  teams: Team[],
  matches: Match[],
  sets: SetResult[],
) {
  return teams.map((team) => {
    const teamMatches = matches.filter(
      (match) => match.teamAId === team.id || match.teamBId === team.id,
    );
    const completedMatches = teamMatches.filter((match) => match.status === "completed");
    const matchWins = completedMatches.filter((match) => match.winnerTeamId === team.id).length;
    const matchLosses = completedMatches.length - matchWins;
    const teamSets = sets.filter((set) => set.blueTeamId === team.id || set.redTeamId === team.id);
    const setWins = teamSets.filter((set) => set.winnerTeamId === team.id).length;
    const setLosses = teamSets.filter((set) => set.winnerTeamId && set.winnerTeamId !== team.id).length;
    const nextMatch = teamMatches
      .filter((match) => match.status !== "completed")
      .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())[0];

    return {
      rank: 0,
      team,
      matchRecord: `${matchWins}-${matchLosses}`,
      setRecord: `${setWins}-${setLosses}`,
      winRate:
        completedMatches.length === 0
          ? "-"
          : `${Math.round((matchWins / completedMatches.length) * 100)}%`,
      setDiff: setWins - setLosses,
      recent: completedMatches
        .slice(-5)
        .map((match) => (match.winnerTeamId === team.id ? "W" : "L"))
        .join("-") || "-",
      nextMatch,
    };
  }).sort((a, b) => {
    if (b.setDiff !== a.setDiff) {
      return b.setDiff - a.setDiff;
    }
    return a.team.name.localeCompare(b.team.name);
  }).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildTeamSummary({
  team,
  teams,
  players,
  matches,
  sets,
  fanRatings,
  communityPosts,
}: {
  team: Team;
  teams: Team[];
  players: Player[];
  matches: Match[];
  sets: SetResult[];
  fanRatings: FanRating[];
  communityPosts: CommunityPost[];
}) {
  const standings = buildTeamStandingRows(teams, matches, sets);
  const teamMatches = matches.filter(
    (match) => match.teamAId === team.id || match.teamBId === team.id,
  );
  const teamPlayers = players.filter((player) => player.teamId === team.id);
  const fanRatingItems = fanRatings.filter((rating) => rating.teamId === team.id);
  const avgFanRating =
    fanRatingItems.length === 0
      ? "-"
      : (
          fanRatingItems.reduce((sum, rating) => sum + rating.rating, 0) /
          fanRatingItems.length
        ).toFixed(1);

  return {
    standing: standings.find((row) => row.team.id === team.id),
    matches: teamMatches,
    players: teamPlayers,
    avgFanRating,
    fanPogCount: fanRatingItems.length,
    officialPomCount: matches.filter((match) =>
      teamPlayers.some((player) => player.id === match.officialPomPlayerId),
    ).length,
    recentReviews: communityPosts.filter(
      (post) => post.siteScope === "team" && post.teamId === team.id,
    ),
  };
}

export function buildTeamStatSummary(teamId: string, sets: SetResult[]) {
  const teamSets = sets.filter((set) => set.blueTeamId === teamId || set.redTeamId === teamId);
  const count = Math.max(teamSets.length, 1);
  const sumBySide = (blueKey: keyof SetResult, redKey: keyof SetResult) =>
    teamSets.reduce((sum, set) => {
      const value = set.blueTeamId === teamId ? set[blueKey] : set[redKey];
      return sum + (typeof value === "number" ? value : 0);
    }, 0);

  return {
    avgKills: sumBySide("blueKills", "redKills") / count,
    avgDeaths: teamSets.reduce((sum, set) => {
      const value = set.blueTeamId === teamId ? set.redKills : set.blueKills;
      return sum + (value ?? 0);
    }, 0) / count,
    avgGold: Math.round(sumBySide("blueGold", "redGold") / count),
    avgCs: 0,
    dragonRate: "-",
    baronRate: "-",
    avgTowers: (sumBySide("blueTowers", "redTowers") / count).toFixed(1),
    avgDpm: 0,
    avgVisionScore: 0,
    radarFight: 0,
    radarDamage: 0,
    radarGrowth: 0,
    radarVision: 0,
    radarObjective: 0,
    radarStability: 0,
  };
}

export function buildPlayerSummary({
  player,
  teams,
  players,
  playerStatLines,
  fanRatings,
  matches,
}: {
  player: Player;
  teams: Team[];
  players: Player[];
  playerStatLines: PlayerStatLine[];
  fanRatings: FanRating[];
  matches: Match[];
}) {
  const statLine = playerStatLines.find((line) => line.playerId === player.id);
  const stats = statLine ? calculatePlayerStats(statLine) : null;
  const team = findTeam(teams, player.teamId);
  const fanRatingItems = fanRatings.filter((rating) => rating.playerId === player.id);
  const avgFanRating =
    fanRatingItems.length === 0
      ? "-"
      : (
          fanRatingItems.reduce((sum, rating) => sum + rating.rating, 0) /
          fanRatingItems.length
        ).toFixed(1);

  return {
    team,
    stats,
    avgFanRating,
    fanPogCount: fanRatingItems.length,
    officialPomCount: matches.filter((match) => match.officialPomPlayerId === player.id).length,
    sameTeamPlayers: players.filter(
      (item) => item.teamId === player.teamId && item.id !== player.id,
    ),
  };
}
