export type MatchActivityTeam = {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
};

export type LiveMatchActivity = {
  id: string;
  href: string;
  competitionLabel: string;
  teamA: MatchActivityTeam;
  teamB: MatchActivityTeam;
  teamAScore: number | null;
  teamBScore: number | null;
  currentSetNumber: number | null;
};

export type RatingMatchActivity = {
  id: string;
  href: string;
  matchId: string;
  competitionLabel: string;
  setNumber: number;
  closesAt: string;
  teamA: MatchActivityTeam;
  teamB: MatchActivityTeam;
};

export type MatchActivityResponse = {
  liveMatches: LiveMatchActivity[];
  ratings: RatingMatchActivity[];
};
