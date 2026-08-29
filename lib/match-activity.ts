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
  /** 평가 마감이 아니라 알림 카드 표시 종료 시각이다. */
  closesAt: string;
  teamA: MatchActivityTeam;
  teamB: MatchActivityTeam;
};

export type MatchActivityResponse = {
  liveMatches: LiveMatchActivity[];
  ratings: RatingMatchActivity[];
};

export type MatchActivityNotificationResponse = MatchActivityResponse & {
  teamNotificationSettings: Array<{
    teamId: string;
    matchAlertsEnabled: boolean;
    liveMatchAlertsEnabled: boolean;
  }>;
};
