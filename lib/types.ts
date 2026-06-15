export type Team = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  logoUrl: string;
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
};

export type Tournament = {
  id: string;
  name: string;
  season: number;
  category: string;
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
  playerId: string;
  teamId: string;
  position: PlayerPosition;
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
