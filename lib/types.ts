export type Team = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  logoUrl: string;
  logoWhiteUrl: string;
  backgroundUrl: string;
  primaryColor: string;
  secondaryColor: string;
  fanSiteHost: string;
  officialHomepageUrl: string;
  officialYoutubeUrl: string;
  officialXUrl: string;
  officialInstagramUrl: string;
  leaguepediaPage?: string;
  sourceTeamId?: string;
  isLckTeam?: boolean;
  importedScope?: "lck" | "international_event" | "manual";
  isActive?: boolean;
  headCoach?: string | null;
  coaches?: string | null;
  identityHistory?: TeamIdentityHistory[];
};

export type TeamIdentityHistory = {
  id: string;
  teamId: string;
  name: string;
  shortName: string;
  slug: string;
  logoUrl: string;
  sponsorName?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  note?: string;
};

export type TeamStanding = {
  id: string;
  tournamentId: string;
  teamId: string;
  rank: number;
  wins: number;
  losses: number;
  setDiff: number;
  winRate: number | null;
  kda: number | null;
  kills: number;
  deaths: number;
  assists: number;
};

export type AwardType =
  | "lck_champion"
  | "lck_runner_up"
  | "worlds_champion"
  | "worlds_runner_up"
  | "msi_champion"
  | "msi_runner_up"
  | "first_stand_champion"
  | "first_stand_runner_up"
  | "ewc_champion"
  | "ewc_runner_up"
  | "lck_finals_mvp"
  | "worlds_mvp"
  | "msi_mvp"
  | "all_lck_first"
  | "all_lck_second"
  | "rookie_of_year";

export type TeamAward = {
  id: string;
  teamId: string;
  year: number;
  tournamentName: string;
  awardType: AwardType;
  playerId?: string | null;
  playerName?: string | null;
  notes?: string | null;
  source: string;
  leaguepediaPage?: string | null;
};

export type PlayerPosition = "TOP" | "JGL" | "MID" | "BOT" | "SUP";

export type Player = {
  id: string;
  slug: string;
  name: string;
  realName: string;
  teamId: string;
  position: PlayerPosition;
  profileImageUrl: string;
  streamUrl?: string;
  soloQueueAccount?: string;
  isStarter?: boolean;
  isLckPlayer?: boolean;
  importedScope?: "lck" | "international_event" | "manual";
  isActive?: boolean;
  retiredAt?: string | null;
};

export type PlayerCareerHistory = {
  id: string;
  playerId: string;
  teamId: string | null;
  teamName: string | null;
  position: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
};

export type Tournament = {
  id: string;
  name: string;
  season: number;
  category: string;
  split?: string | null;
  region?: string | null;
  league?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  source?: string | null;
  sourceTournamentId?: string | null;
};

export type Stage = {
  id: string;
  tournamentId: string;
  name: string;
  orderIndex: number;
};

export type MatchStatus = "scheduled" | "live" | "completed";

export type Match = {
  id: string;
  tournamentId: string;
  stageId: string;
  name: string;
  matchDate: string;
  status: MatchStatus;
  teamAId: string;
  teamBId: string;
  teamAScore: number | null;
  teamBScore: number | null;
  bestOf?: number | null;
  winnerTeamId?: string | null;
  officialPomPlayerId: string | null;
  leaguepediaMatchId?: string | null;
  venue?: string | null;
  vodUrl?: string | null;
};

export type SetResult = {
  id: string;
  matchId: string;
  setNumber: number;
  winnerTeamId: string | null;
  blueTeamId: string;
  redTeamId: string;
  durationSeconds: number | null;
  blueKills: number | null;
  redKills: number | null;
  blueGold: number | null;
  redGold: number | null;
  blueDragons: number | null;
  redDragons: number | null;
  blueClouds?: number | null;
  redClouds?: number | null;
  blueInfernals?: number | null;
  redInfernals?: number | null;
  blueMountains?: number | null;
  redMountains?: number | null;
  blueOceans?: number | null;
  redOceans?: number | null;
  blueHextechs?: number | null;
  redHextechs?: number | null;
  blueChemtechs?: number | null;
  redChemtechs?: number | null;
  blueElders?: number | null;
  redElders?: number | null;
  blueBarons: number | null;
  redBarons: number | null;
  blueTowers: number | null;
  redTowers: number | null;
  patch?: string | null;
  leaguepediaGameId?: string | null;
  riotMatchId?: string | null;
  riotPlatformGameId?: string | null;
};

export type Champion = {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string;
  ddragonId?: string;
  ddragonKey?: string;
  ddragonVersion?: string;
};

export type SetPickBan = {
  id: string;
  setId: string;
  phase: string;
  actionType: "pick" | "ban";
  orderIndex: number;
  teamId: string;
  championId: string;
  side: "blue" | "red";
};

export type PlayerStatLine = {
  setId: string;
  playerId: string;
  teamId: string;
  position: PlayerPosition;
  championId?: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damageToChampions: number;
  teamKills: number;
  teamDamage: number;
  gameMinutes: number;
  visionScore: number;
  itemIds: Array<number | null>;
};

export type DerivedPlayerStats = {
  kda: number;
  kp: number;
  dpm: number;
  dmgPercent: number;
  csm: number;
  gpm: number;
  visionScoreAvg: number;
  formScore: number;
  radarGrowth: number;
  radarFight: number;
  radarDamage: number;
  radarSurvival: number;
  radarVision: number;
  radarEfficiency: number;
};

export type FanRating = {
  id: string;
  setId: string;
  matchId: string;
  playerId: string;
  teamId: string;
  rating: number;
  review: string;
  createdAt: string;
};

export type CommunityPost = {
  id: string;
  boardType: string;
  siteScope: "hub" | "team";
  teamId?: string;
  title: string;
  content: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
};

export type TeamVideo = {
  id: string;
  teamId: string;
  platform: "youtube" | "twitch" | "afreecatv";
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
};

export type TeamSocialPost = {
  id: string;
  teamId: string;
  platform: "x" | "instagram" | "homepage";
  title: string;
  content: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  publishedAt: string;
};
