import type {
  Match,
  Player,
  PlayerCareerHistory,
  Stage,
  Team,
  Tournament,
} from "./types.ts";

export type MatchPreviewRosterLink = {
  playerId: string;
  player: string;
  position: string;
  currentTeam: string;
  opponentTeam: string;
  careerStart: string;
  careerEnd: string | null;
  /** 경력 DB는 검색 후보일 뿐이며, 이적·트레이드 사실의 근거로 쓰면 안 된다. */
  verificationRequired: true;
};

export type MatchPreviewRecentMeeting = {
  matchId: string;
  date: string;
  winner: string;
  score: string;
  daysBefore: number;
};

export type MatchPreviewStoryContext = {
  tournament: string | null;
  stage: string | null;
  bracketSide: Match["bracketSide"];
  bestOf: number | null;
  advancesToMatchId: string | null;
  recentMeeting: MatchPreviewRecentMeeting | null;
  rosterLinks: MatchPreviewRosterLink[];
  reciprocalMoveHint: boolean;
};

function normalizedIdentity(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function teamIdentities(team: Team | undefined) {
  if (!team) return new Set<string>();
  return new Set(
    [
      team.id,
      team.name,
      team.shortName,
      team.slug,
      ...(team.searchAliases ?? []),
      ...(team.identityHistory ?? []).flatMap((identity) => [
        identity.name,
        identity.shortName,
        identity.slug,
      ]),
    ]
      .map(normalizedIdentity)
      .filter(Boolean),
  );
}

function historyMatchesTeam(history: PlayerCareerHistory, team: Team | undefined) {
  if (!team) return false;
  if (history.teamId === team.id) return true;
  if (!history.teamName) return false;
  return teamIdentities(team).has(normalizedIdentity(history.teamName));
}

function teamName(team: Team | undefined, fallback: string) {
  return team?.shortName || team?.name || fallback;
}

function currentRoster(players: Player[], teamId: string) {
  return players.filter(
    (player) =>
      player.teamId === teamId &&
      player.isActive !== false &&
      player.isLckPlayer !== false &&
      player.importedScope !== "challengers",
  );
}

function rosterLinksForSide({
  players,
  careerHistories,
  currentTeam,
  opponentTeam,
}: {
  players: Player[];
  careerHistories: PlayerCareerHistory[];
  currentTeam: Team | undefined;
  opponentTeam: Team | undefined;
}) {
  if (!currentTeam || !opponentTeam) return [];

  return currentRoster(players, currentTeam.id).flatMap((player) => {
    const history = careerHistories
      .filter(
        (item) =>
          item.playerId === player.id &&
          historyMatchesTeam(item, opponentTeam),
      )
      .sort((left, right) => {
        const leftDate = left.endDate ?? left.startDate;
        const rightDate = right.endDate ?? right.startDate;
        return rightDate.localeCompare(leftDate);
      })[0];

    if (!history) return [];
    return [{
      playerId: player.id,
      player: player.name,
      position: player.position,
      currentTeam: teamName(currentTeam, currentTeam.id),
      opponentTeam: teamName(opponentTeam, opponentTeam.id),
      careerStart: history.startDate,
      careerEnd: history.endDate,
      verificationRequired: true as const,
    }];
  });
}

function latestMeeting({
  match,
  matches,
  teamA,
  teamB,
}: {
  match: Match;
  matches: Match[];
  teamA: Team | undefined;
  teamB: Team | undefined;
}): MatchPreviewRecentMeeting | null {
  const currentTime = new Date(match.matchDate).getTime();
  const previous = matches
    .filter((item) => {
      const samePair =
        (item.teamAId === match.teamAId && item.teamBId === match.teamBId) ||
        (item.teamAId === match.teamBId && item.teamBId === match.teamAId);
      return (
        samePair &&
        item.status === "completed" &&
        new Date(item.matchDate).getTime() < currentTime
      );
    })
    .sort((left, right) =>
      new Date(right.matchDate).getTime() - new Date(left.matchDate).getTime(),
    )[0];

  if (!previous?.winnerTeamId) return null;
  const scoreA = previous.teamAId === match.teamAId
    ? previous.teamAScore
    : previous.teamBScore;
  const scoreB = previous.teamAId === match.teamBId
    ? previous.teamAScore
    : previous.teamBScore;
  const winner = previous.winnerTeamId === match.teamAId
    ? teamName(teamA, match.teamAId)
    : teamName(teamB, match.teamBId);

  return {
    matchId: previous.id,
    date: previous.matchDate,
    winner,
    score: `${scoreA ?? 0}:${scoreB ?? 0}`,
    daysBefore: Math.max(
      0,
      Math.round((currentTime - new Date(previous.matchDate).getTime()) / 86_400_000),
    ),
  };
}

export function buildMatchPreviewStoryContext({
  match,
  tournament,
  stage,
  teams,
  matches,
  players = [],
  careerHistories = [],
}: {
  match: Match;
  tournament?: Tournament;
  stage?: Stage;
  teams: Team[];
  matches: Match[];
  players?: Player[];
  careerHistories?: PlayerCareerHistory[];
}): MatchPreviewStoryContext {
  const teamA = teams.find((team) => team.id === match.teamAId);
  const teamB = teams.find((team) => team.id === match.teamBId);
  const rosterLinks = [
    ...rosterLinksForSide({
      players,
      careerHistories,
      currentTeam: teamA,
      opponentTeam: teamB,
    }),
    ...rosterLinksForSide({
      players,
      careerHistories,
      currentTeam: teamB,
      opponentTeam: teamA,
    }),
  ];
  const linkedPositions = new Map<string, Set<string>>();
  for (const link of rosterLinks) {
    const teamsForPosition = linkedPositions.get(link.position) ?? new Set<string>();
    teamsForPosition.add(link.currentTeam);
    linkedPositions.set(link.position, teamsForPosition);
  }

  return {
    tournament: tournament?.name ?? null,
    stage: stage?.name ?? null,
    bracketSide: match.bracketSide ?? null,
    bestOf: match.bestOf ?? null,
    advancesToMatchId: match.advancesToMatchId ?? null,
    recentMeeting: latestMeeting({ match, matches, teamA, teamB }),
    rosterLinks,
    reciprocalMoveHint: [...linkedPositions.values()].some((teamNames) => teamNames.size >= 2),
  };
}
