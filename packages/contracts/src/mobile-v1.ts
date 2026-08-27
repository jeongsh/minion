/**
 * Platform-independent contract for the MINION mobile API.
 *
 * Keep this module free of Next.js, React and React Native imports so the web
 * server and the Expo application can consume the exact same definitions.
 */

export const MOBILE_API_VERSION = "v1" as const;
export const MOBILE_API_PREFIX = `/api/mobile/${MOBILE_API_VERSION}` as const;

export type IsoDateTime = string;
export type EntityId = string;
export type Cursor = string;

export type MobileApiMeta = {
  requestId: string;
  generatedAt: IsoDateTime;
  version: typeof MOBILE_API_VERSION;
  etag?: string;
};

export type MobileApiSuccess<T> = {
  data: T;
  meta: MobileApiMeta;
};

export type MobileApiError = {
  error: {
    code: "BAD_REQUEST" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL";
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
  meta: MobileApiMeta;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: Cursor | null;
  hasMore: boolean;
};

export type MobileImage = {
  url: string;
  width?: number;
  height?: number;
  blurhash?: string;
};

export type MobileTeamSummary = {
  id: EntityId;
  slug: string;
  fanSiteHost: string;
  name: string;
  shortName: string;
  logo: MobileImage | null;
  logoDark: MobileImage | null;
  useWhiteLogoOnDark: boolean;
  primaryColor: string;
  onPrimaryColor: string;
  isLckTeam: boolean;
};

export type MobilePlayerSummary = {
  id: EntityId;
  slug: string;
  name: string;
  position: "TOP" | "JGL" | "MID" | "BOT" | "SUP" | "COACH" | null;
  teamId: EntityId | null;
  profileImage: MobileImage | null;
};

export type MobilePlayerDirectoryItem = MobilePlayerSummary & {
  realName: string;
  isStarter?: boolean;
};

export type MobileTournamentSummary = {
  id: EntityId;
  name: string;
  season: number;
  split: string | null;
  league: string | null;
  category: string;
};

export type MobileMatchSummary = {
  id: EntityId;
  name: string;
  startsAt: IsoDateTime;
  status: "scheduled" | "live" | "completed" | "cancelled";
  bestOf: number | null;
  tournament: MobileTournamentSummary | null;
  teamA: MobileTeamSummary | null;
  teamB: MobileTeamSummary | null;
  teamAScore: number | null;
  teamBScore: number | null;
  winnerTeamId: EntityId | null;
};

export type MobileCommunityAuthor = {
  id: EntityId | null;
  nickname: string | null;
  profileImage: MobileImage | null;
  tier: string | null;
  guestIpLabel: string | null;
  favoriteTeam: {
    id: EntityId;
    slug: string;
    name: string;
    shortName: string;
    primaryColor: string;
  } | null;
};

export type MobileCommunityPostSummary = {
  id: EntityId;
  scope: "hub" | "team";
  teamId: EntityId | null;
  boardType: string;
  title: string;
  excerpt: string;
  thumbnail: MobileImage | null;
  author: MobileCommunityAuthor;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: IsoDateTime;
  isNotice: boolean;
  isHot: boolean;
  isBlinded: boolean;
  blindedSource?: "ai" | "report" | "admin" | null;
};

export type TiptapDocument = {
  type: "doc";
  content?: TiptapNode[];
};

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

export type MobileCommunityComment = {
  id: EntityId;
  postId: EntityId;
  parentId: EntityId | null;
  author: MobileCommunityAuthor;
  content: TiptapDocument | string;
  likeCount: number;
  dislikeCount: number;
  reaction: "honor" | "dislike" | null;
  createdAt: IsoDateTime;
  isBlinded: boolean;
  isDeleted: boolean;
  blindedSource?: "ai" | "report" | "admin" | null;
  permissions: { canEdit: boolean; canDelete: boolean; canReport: boolean };
};

export type MobileBootstrapDto = {
  minimumSupportedVersion: string;
  maintenance: { enabled: boolean; message: string | null };
  viewer: {
    id: EntityId;
    nickname: string | null;
    profileImage: MobileImage | null;
    tier: string;
    lp: number;
    favoriteTeamId: EntityId | null;
    favoriteTeamSlug: string | null;
    followedTeamIds: EntityId[];
  } | null;
  teams: MobileTeamSummary[];
  featureFlags: Record<string, boolean>;
};

export type MobileNotificationPreferences = {
  inAppEnabled: boolean;
  matchStartEnabled: boolean;
  matchEventsEnabled: boolean;
  ratingOpenEnabled: boolean;
};

export type MobileMatchActivityTeam = {
  id: EntityId;
  name: string;
  shortName: string;
  logoUrl: string | null;
};

export type MobileLiveMatchActivity = {
  id: EntityId;
  href: string;
  competitionLabel: string;
  teamA: MobileMatchActivityTeam;
  teamB: MobileMatchActivityTeam;
  teamAScore: number | null;
  teamBScore: number | null;
  currentSetNumber: number | null;
};

export type MobileRatingMatchActivity = {
  id: EntityId;
  matchId: EntityId;
  href: string;
  competitionLabel: string;
  setNumber: number;
  closesAt: IsoDateTime;
  teamA: MobileMatchActivityTeam;
  teamB: MobileMatchActivityTeam;
};

export type MobileMatchActivityDto = {
  liveMatches: MobileLiveMatchActivity[];
  ratings: MobileRatingMatchActivity[];
  notificationPreferences: MobileNotificationPreferences;
};

export type MobileCommunityNotification = {
  id: EntityId;
  kind: "post_activity";
  title: string;
  description?: string;
  href?: string;
  imageUrl?: string | null;
  createdAt: IsoDateTime;
  readAt: IsoDateTime | null;
};

export type MobileCommunityNotificationsDto = {
  notifications: MobileCommunityNotification[];
};

export type MobileMeDto = {
  profile: {
    id: EntityId;
    email: string | null;
    nickname: string | null;
    profileImage: MobileImage | null;
    tier: string;
    lp: number;
    favoriteTeamId: EntityId | null;
    followedTeamIds: EntityId[];
    authProvider: string | null;
    status: "active" | "deleted";
  };
  notificationPreferences: MobileNotificationPreferences;
  rank: {
    checkedInToday: boolean;
    overallRank: number | null;
    progressLabel: string;
    progressRatio: number;
  };
  account: {
    hasPassword: boolean;
    recentlyReauthenticated: boolean;
  };
  activity: {
    postCount: number;
    commentCount: number;
    recentPosts: Array<{ id: EntityId; title: string; createdAt: IsoDateTime }>;
    recentComments: Array<{ id: EntityId; postId: EntityId; content: string; createdAt: IsoDateTime }>;
  };
  blockedUsers: Array<{ id: EntityId; nickname: string; profileImage: MobileImage | null; tier: string }>;
  blockedGuests: Array<{ guestKey: string; nickname: string; createdAt: IsoDateTime }>;
};

export type MobileHomeDto = {
  teams: MobileTeamSummary[];
  matches: MobileMatchSummary[];
  standings: Array<{ teamId: EntityId; rank: number; wins: number; losses: number; setDiff: number }>;
  calendar: Array<{ date: string; matches: MobileMatchSummary[] }>;
  calendarEvents: Array<{
    id: EntityId;
    type: "birthday" | "debut" | "championship" | "custom";
    title: string;
    date: string;
    monthDay: string;
    isRecurring: boolean;
    dday: number;
    image: MobileImage | null;
    eventTime?: string | null;
    sourceUrl?: string | null;
  }>;
  celebrations: Array<{
    id: EntityId;
    type: "birthday" | "debut" | "championship" | "custom";
    title: string;
    subjectName: string;
    yearsCount: number | null;
    teamShort: string | null;
    teamSlug: string | null;
    image: MobileImage | null;
  }>;
  news: MobileNewsItem[];
  community: MobileCommunityPostSummary[];
  pom: Array<{
    matchId: EntityId;
    playerSlug: string;
    playerName: string;
    playerImage: MobileImage | null;
    position: string;
    teamShortName: string;
    teamLogo: MobileImage | null;
    teamPrimaryColor: string | null;
    opponentShortName: string;
    tournamentName: string;
    scoreLabel: string | null;
  }>;
  videos: MobileVideoItem[];
};

export type MobileScheduleDto = {
  filters: {
    years: number[];
    activeYear: number;
    activeMonth: number;
    activeSegment: string;
    activeTeamId: EntityId | null;
  };
  matches: MobileMatchSummary[];
};

export type MobileStandingRow = {
  rank: number;
  team: MobileTeamSummary;
  matchWins: number;
  matchLosses: number;
  setDiff: number;
  winRate: string;
};

export type MobileStandingsGroup = {
  /** 조가 없는 통합 순위표면 빈 문자열("바론 그룹" 등 그룹 이름이 없을 때). */
  title: string;
  rows: MobileStandingRow[];
};

export type MobilePomRow = {
  rank: number;
  player: MobilePlayerSummary;
  team: MobileTeamSummary | null;
  count: number;
  points: number;
};

export type MobileTournamentSegmentNavItem = {
  key: string;
  name: string;
  logo: string | null;
  logoAspect: number;
  isOngoing: boolean;
};

export type MobileBracketStagePill = { id: EntityId; name: string };

export type MobileBracketMatch = {
  id: EntityId;
  matchDate: IsoDateTime;
  teamA: MobileTeamSummary | null;
  teamB: MobileTeamSummary | null;
  teamAScore: number | null;
  teamBScore: number | null;
  winnerTeamId: EntityId | null;
  status: string;
};

export type MobileBracketColumn = {
  /** 웹 브래킷 grid에서의 원래 열 위치. 비어 있는 앞 열을 앱에서도 보존한다. */
  columnIndex: number;
  label: string;
  lowerLabel: string | null;
  matches: MobileBracketMatch[];
  lowerMatches: MobileBracketMatch[];
};

export type MobileBracketGroup = {
  columns: MobileBracketColumn[];
};

export type MobileBracketConnection = {
  fromMatchId: EntityId;
  toMatchId: EntityId;
  fromRow: 0 | 1 | null;
  toRow: 0 | 1 | null;
};

export type MobileBracketData = {
  /** 결승 열을 제외한 웹 브래킷의 전체 열 수. */
  columnCount: number;
  groups: MobileBracketGroup[];
  finals: { label: string; match: MobileBracketMatch } | null;
  connections: MobileBracketConnection[];
};

export type MobileTournamentDetailDto = {
  segment: { key: string; name: string; logo: string | null; logoAspect: number; accent: string };
  seasons: number[];
  activeSeason: number;
  segmentNav: MobileTournamentSegmentNavItem[];
  isLck: boolean;
  /** LCK만: 스플릿 선택. */
  activeSplit: "1" | "2" | "3" | null;
  splitLabels: Record<"1" | "2" | "3", string> | null;
  viewLabels: { standings: string; bracket: string } | null;
  /** LCK: "pom"|"standings"|"bracket". 그 외: "standings"|"bracket". */
  activeView: "pom" | "standings" | "bracket";
  activePhase: "playin" | "playoffs" | null;
  /** 그 외 대회만: 대진표 스테이지 선택 필. */
  bracketStages: MobileBracketStagePill[];
  activeBracketStageId: EntityId | null;
  supportsGroupToggle: boolean;
  /** activeView==="standings"일 때만 채워짐. */
  standingsGroups: MobileStandingsGroup[] | null;
  /** activeView==="pom"일 때만(LCK만 지원) 채워짐. */
  pomRows: MobilePomRow[] | null;
  /** activeView==="bracket"일 때, 실제로 보여줄 대진표 데이터가 있는지. */
  bracketAvailable: boolean;
  /** activeView==="bracket" && bracketAvailable일 때만 채워짐. */
  bracket: MobileBracketData | null;
};

export type MobilePredictionMarket = {
  teamAPercent: number;
  teamBPercent: number;
  teamAOdds: number | null;
  teamBOdds: number | null;
};

export type MobilePredictionBet = {
  id: EntityId;
  matchId: EntityId;
  teamId: EntityId;
  stake: number;
};

export type MobilePredictionMatch = {
  id: EntityId;
  startsAt: IsoDateTime;
  status: string;
  tournamentId: EntityId | null;
  teamA: MobileTeamSummary | null;
  teamB: MobileTeamSummary | null;
  market: MobilePredictionMarket;
  closed: boolean;
  myBet: MobilePredictionBet | null;
};

export type MobilePredictionsDto = {
  /** 서버가 응답을 만든 시각(epoch ms). 마감까지 남은 시간 표시는 이 값 기준으로 고정 계산한다(웹도 요청당 한 번만 스냅샷). */
  now: number;
  balance: number | null;
  matches: MobilePredictionMatch[];
};

export type MobilePredictionMutationDto = {
  balance: number;
};

export type MobileMatchSetSummary = {
  id: EntityId;
  setNumber: number;
  status: string;
  winnerTeamId: EntityId | null;
  durationSeconds: number | null;
};

export type MobileChampionRef = {
  id: EntityId | null;
  name: string;
  image: MobileImage | null;
};

export type MobileSetDraftSide = {
  teamId: EntityId;
  teamName: string;
  /** 항상 5칸, 밴이 없으면 null로 채움. */
  bans: Array<MobileChampionRef | null>;
};

export type MobileObjectiveCounts = {
  voidGrubs: number;
  dragons: number;
  heralds: number;
  barons: number;
  towers: number;
  elders: number;
};

export type MobilePlayerLoadout = {
  champion: MobileChampionRef;
  /** 항상 2칸. */
  spellImages: Array<MobileImage | null>;
  /** [키스톤, 보조 계열] 항상 2칸. */
  runeImages: Array<MobileImage | null>;
  /** 일반 아이템 6칸. */
  itemImages: Array<MobileImage | null>;
  trinketImage: MobileImage | null;
  roleBoundItemImage: MobileImage | null;
};

export type MobileSetPlayerStat = {
  playerId: EntityId;
  playerName: string;
  teamId: EntityId;
  position: "TOP" | "JGL" | "MID" | "BOT" | "SUP";
  loadout: MobilePlayerLoadout;
  championLevel: number | null;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  killParticipation: number;
  damage: number;
  dpm: number;
  visionScore: number;
  cs: number;
  csm: number;
  gold: number;
};

export type MobileTimelineEvent = {
  id: EntityId;
  timestampMs: number;
  eventType: "CHAMPION_KILL" | "ELITE_MONSTER_KILL" | "BUILDING_KILL";
  teamId: EntityId | null;
  killerPlayerId: EntityId | null;
  victimPlayerId: EntityId | null;
  assistPlayerIds: EntityId[];
  monsterType: string | null;
  buildingType: string | null;
  laneType: string | null;
};

export type MobileTimelineFrame = {
  timestampMs: number;
  goldDiff: number | null;
  blueTotalGold: number | null;
  redTotalGold: number | null;
};

export type MobileSetDetail = {
  id: EntityId;
  setNumber: number;
  durationSeconds: number | null;
  winnerTeamId: EntityId | null;
  blueTeamId: EntityId;
  redTeamId: EntityId;
  blueTeam: MobileTeamSummary | null;
  redTeam: MobileTeamSummary | null;
  blueKills: number | null;
  redKills: number | null;
  blueGold: number | null;
  redGold: number | null;
  blueObjectives: MobileObjectiveCounts;
  redObjectives: MobileObjectiveCounts;
  hasPickBan: boolean;
  draft: { blue: MobileSetDraftSide; red: MobileSetDraftSide } | null;
  playerStats: MobileSetPlayerStat[];
  timelineEvents: MobileTimelineEvent[];
  timelineFrames: MobileTimelineFrame[];
};

export type MobileMatchHeader = {
  tournamentName: string;
  stageName: string;
  bestOf: number | null;
  pomPlayer: MobilePlayerSummary | null;
  statusLabel: string;
};

export type MobileMatchPreview = {
  prediction: MobilePredictionMarket & { closed: boolean };
  ai: {
    summary: string;
    watchPoint: string;
    winProbabilityA: number | null;
    sources: Array<{ title: string; url: string }>;
  };
  metrics: {
    recentRecordA: string;
    recentRecordB: string;
    setDiffA: number;
    setDiffB: number;
    averageKillsA: number | null;
    averageKillsB: number | null;
  };
  meetings: MobileMatchSummary[];
};

export type MobileFanRatingPlayer = {
  id: EntityId;
  name: string;
  position: MobilePlayerSummary["position"];
  team: MobileTeamSummary | null;
  profileImage: MobileImage | null;
  champion: MobileChampionRef | null;
  averageRating: number | null;
  ratingCount: number;
  isPog: boolean;
};

export type MobileFanRatingComment = {
  id: EntityId;
  playerId: EntityId;
  playerName: string;
  playerImage: MobileImage | null;
  rating: number;
  review: string;
  authorName: string;
  authorImage: MobileImage | null;
  authorTier: string;
  honorCount: number;
  dislikeCount: number;
};

export type MobileFanRatingPanel = {
  ratingOpen: boolean;
  snapshotAvailable: boolean;
  statusNote: string;
  players: MobileFanRatingPlayer[];
  comments: MobileFanRatingComment[];
};

export type MobileMatchDetailDto = {
  match: MobileMatchSummary;
  header: MobileMatchHeader;
  sets: MobileMatchSetSummary[];
  activeSetId: EntityId | null;
  activeSet: MobileSetDetail | null;
  players: MobilePlayerSummary[];
  preview: MobileMatchPreview;
  fanRating: MobileFanRatingPanel | null;
  vods: MobileVideoItem[];
  matchVodUrl: string | null;
  live: { pollingIntervalMs: number; available: boolean };
};

export type MobileCommunityPostDetailDto = MobileCommunityPostSummary & {
  content: TiptapDocument;
  reaction: "honor" | "dislike" | null;
  comments: MobileCommunityComment[];
  permissions: { canEdit: boolean; canDelete: boolean; canReact: boolean; canReport: boolean; canBlock: boolean };
};

export type MobileCommunityPostsDto = {
  items: MobileCommunityPostSummary[];
  notices: MobileCommunityPostSummary[];
  popular: MobileCommunityPostSummary[];
  page: number;
  totalPages: number;
  totalCount: number;
  categories: Array<{ slug: string; label: string }>;
};

export type MobileCommunityPostMutationDto = { id: EntityId; message: string };
export type MobileCommunityCommentMutationDto = { id: EntityId; message: string };
export type MobileCommunityActionDto = { message: string };
export type MobileCommunityReactionDto = {
  state: "honor" | "dislike" | null;
  honorCount: number;
  dislikeCount: number;
};
export type MobileCommunityPollDto = {
  counts: Record<string, number>;
  total: number;
  myOptionId: string | null;
  signedIn: boolean;
};
export type MobileCommunityUploadDto = {
  url: string;
  path: string;
  width: number;
  height: number;
};

export type MobileCommunityUserActivityPost = MobileCommunityPostSummary & {
  teamSlug: string | null;
};

export type MobileCommunityUserActivityComment = {
  id: EntityId;
  postId: EntityId;
  postTitle: string;
  postScope: "hub" | "team";
  postTeamSlug: string | null;
  content: string;
  createdAt: IsoDateTime;
  isBlinded: boolean;
  blindedSource: "ai" | "report" | "admin" | null;
};

export type MobileCommunityUserDto = {
  profile: MobileCommunityAuthor & { createdAt: IsoDateTime };
  tab: "posts" | "comments";
  posts: MobileCommunityUserActivityPost[];
  comments: MobileCommunityUserActivityComment[];
  postCount: number;
  commentCount: number;
  page: number;
  totalPages: number;
  permissions: { isSelf: boolean; canBlock: boolean; canReport: boolean };
};

export type MobileNewsItem = {
  id: EntityId;
  title: string;
  source: string;
  publishedAt: IsoDateTime;
  url: string;
  thumbnail: MobileImage | null;
};

export type MobileVideoItem = {
  id: EntityId;
  routeId?: string;
  title: string;
  url: string;
  embedUrl?: string | null;
  thumbnail: MobileImage | null;
  publishedAt: IsoDateTime | null;
  channelName: string | null;
  isNew?: boolean;
};

export type MobileTeamDetailDto = {
  calendarEvents: MobileHomeDto["calendarEvents"];
  team: MobileTeamSummary;
  headerImage: MobileImage | null;
  matches: MobileMatchSummary[];
  community: MobileCommunityPostSummary[];
  players: MobilePlayerDirectoryItem[];
  social: Array<{ id: EntityId; title: string; image: MobileImage | null; url: string; publishedAt: IsoDateTime | null; ownerName: string }>;
  videos: MobileVideoItem[];
};

export type MobileTeamsPageDto = {
  items: MobileTeamSummary[];
  followedTeamIds: EntityId[];
  selected: Pick<MobileTeamDetailDto, "team" | "social" | "videos"> | null;
};

export type MobileTeamFanDto = {
  fanCount: number;
  following: boolean;
};

export type MobileTeamNotificationDto = { enabled: boolean };
export type MobileTeamFavoriteDto = { favorite: boolean };
export type MobileFanCalendarSubmissionDto = { message: string };

export type MobileTeamsDto = { items: MobileTeamSummary[] };
export type MobilePlayersDto = {
  items: MobilePlayerDirectoryItem[];
  challengersItems: MobilePlayerDirectoryItem[];
  teams: MobileTeamSummary[];
};

export type MobileChampionPosition = "TOP" | "JGL" | "MID" | "BOT" | "SUP";

export type MobileChampionScope = {
  season: number;
  tournament: string | "all";
  patch: string | "all";
  seasons: number[];
  tournaments: Array<{ value: string; label: string }>;
  patches: string[];
};

export type MobileChampionSummary = {
  id: EntityId;
  slug: string;
  name: string;
  image: MobileImage | null;
};

export type MobileChampionDirectoryItem = MobileChampionSummary & {
  picks: number;
  bans: number;
  presenceRate: number | null;
  winRate: number | null;
  positions: MobileChampionPosition[];
};

export type MobileChampionsDto = {
  schemaVersion: 1;
  items: MobileChampionDirectoryItem[];
  scope: MobileChampionScope;
  selected: {
    position: MobileChampionPosition | "all";
    query: string;
    sort: "presence" | "picks" | "bans" | "winRate" | "name";
  };
};

export type MobileChampionPreferenceStat = {
  games: number;
  winRate: number;
  selectionRate: number;
};

export type MobileChampionItem = MobileChampionPreferenceStat & {
  id: number;
  name: string;
  image: MobileImage | null;
};

export type MobileChampionItemSequence = MobileChampionPreferenceStat & {
  items: Array<{ id: number; name: string; image: MobileImage | null; minute: number | null }>;
};

export type MobileChampionRuneOption = {
  name: string;
  image: MobileImage | null;
  selected: boolean;
};

export type MobileChampionRuneColumn = {
  name: string;
  image: MobileImage | null;
  rows: MobileChampionRuneOption[][];
};

export type MobileChampionBuild = {
  runes: {
    primary: MobileChampionRuneColumn | null;
    secondary: MobileChampionRuneColumn | null;
    shards: MobileChampionRuneOption[][];
  };
  spells: Array<MobileChampionPreferenceStat & { items: Array<{ id: number; name: string; image: MobileImage | null }> }>;
  skill: (MobileChampionPreferenceStat & { order: number[]; icons: Record<string, MobileImage | null> }) | null;
  startingItems: MobileChampionItemSequence[];
  boots: MobileChampionItem[];
  trinkets: MobileChampionItem[];
  core3: MobileChampionItemSequence[];
  core4: MobileChampionItem[];
  core5: MobileChampionItem[];
  core6: MobileChampionItem[];
};

export type MobileChampionMatchup = {
  champion: MobileChampionSummary | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  goldDiffAt15: number | null;
};

export type MobileChampionDuo = {
  champion: MobileChampionSummary | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  goldDiffAt15: number | null;
};

export type MobileChampionPro = {
  player: MobilePlayerSummary | null;
  team: MobileTeamSummary | null;
  games: number;
  winRate: number;
  kda: number;
  dpm: number | null;
  goldDiffAt15: number | null;
};

export type MobileChampionGame = {
  setId: EntityId;
  matchId: EntityId;
  href: string | null;
  result: "W" | "L";
  tournament: string;
  player: MobilePlayerSummary | null;
  opponentChampion: MobileChampionSummary | null;
  kills: number;
  deaths: number;
  assists: number;
  kda: number | null;
  items: Array<{ id: number; image: MobileImage | null }>;
};

export type MobileChampionDetailDto = {
  schemaVersion: 1;
  champion: MobileChampionSummary;
  champions: MobileChampionSummary[];
  scope: MobileChampionScope;
  selectedPosition: MobileChampionPosition;
  positions: Array<{ value: MobileChampionPosition; label: string; picks: number }>;
  summary: {
    picks: number;
    bans: number;
    presenceRate: number | null;
    winRate: number | null;
    wins: number;
    losses: number;
  };
  build: MobileChampionBuild;
  matchups: MobileChampionMatchup[];
  duos: MobileChampionDuo[];
  pros: MobileChampionPro[];
  games: MobileChampionGame[];
  stats: {
    patches: Array<{ patch: string; games: number; wins: number; losses: number; winRate: number | null }>;
    sides: Array<{ side: "blue" | "red"; games: number; wins: number; losses: number; winRate: number | null }>;
    pickPhases: Array<{ key: string; count: number; rate: number }>;
    banPhases: Array<{ key: string; count: number; rate: number }>;
  };
};

export type MobilePlayerDetailAxis = {
  label: "KDA" | "DPM" | "VS" | "CSM" | "GD10" | "XPD10" | "GD15" | "XPD15";
  score: number;
  raw: number;
  averageScore: number | null;
  averageRaw: number | null;
  decimals: number;
};

export type MobilePlayerChampionRow = {
  id: EntityId | null;
  slug: string | null;
  name: string;
  image: MobileImage | null;
  setCount: number;
  winRate: number | null;
  kda: number | null;
  averageDamage: number | null;
  dpm: number | null;
  csm: number | null;
  averageRating: number | null;
  fanPogCount: number;
};

export type MobilePlayerRecentSet = {
  id: EntityId;
  setNumber: number;
  rating: number | null;
  championLevel: number | null;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  damage: number;
  dpm: number;
  visionScore: number;
  cs: number;
  csm: number;
  gold: number;
  loadout: MobilePlayerLoadout;
};

export type MobilePlayerRecentMatch = {
  id: EntityId;
  name: string;
  startsAt: IsoDateTime;
  playerTeamId: EntityId;
  opponent: MobileTeamSummary | null;
  winnerTeamId: EntityId | null;
  teamAScore: number | null;
  teamBScore: number | null;
  teamAId: EntityId;
  teamBId: EntityId;
  fanPog: boolean;
  officialPomName: string;
  sets: MobilePlayerRecentSet[];
};

export type MobilePlayerReview = {
  id: EntityId;
  rating: number;
  review: string;
  authorId: EntityId | null;
  authorName: string;
  authorImage: MobileImage | null;
  authorTier: string;
  meta: string;
  href: string | null;
};

export type MobilePlayerDetailDto = {
  schemaVersion: 2;
  player: MobilePlayerSummary & {
    realName: string;
    socialLinks: Array<{ id: string; label: string; url: string }>;
  };
  team: MobileTeamSummary | null;
  segments: Array<{ value: string; label: string }>;
  activeSegment: string;
  teamMeta: { rank: number | null; recent: string };
  axes: MobilePlayerDetailAxis[];
  season: {
    label: string;
    setCount: number;
    wins: number;
    losses: number;
    winRate: number | null;
    kda: number | null;
    kdaLine: string;
    formScore: number | null;
    pomCount: number;
  };
  champions: MobilePlayerChampionRow[];
  recentMatches: MobilePlayerRecentMatch[];
  fan: {
    averageRating: number | null;
    pogCount: number;
    reviews: MobilePlayerReview[];
  };
};
export type MobileTournamentsDto = { items: MobileTournamentSummary[]; matches: MobileMatchSummary[] };
export type MobileNewsDto = CursorPage<MobileNewsItem> & {
  total: number;
  page: number;
  totalPages: number;
  query: string;
  teamSlug: string | null;
  isFallback: boolean;
  teams: MobileTeamSummary[];
};

export type MobileSearchResult = {
  type: "team" | "player" | "match" | "tournament";
  title: string;
  subtitle: string;
  href: string;
  image: MobileImage | null;
};

export type MobileSearchDto = { query: string; results: MobileSearchResult[] };

export type MobileApiRouteDefinition = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  owner: string;
  auth: "public" | "optional" | "required";
  cache: "no-store" | `${number}s`;
};

/** The v1 surface is an allow-list. Admin and report routes never belong here. */
export const mobileApiRoutes = {
  bootstrap: { method: "GET", path: `${MOBILE_API_PREFIX}/bootstrap`, owner: "shell/auth + lib/data/lck", auth: "optional", cache: "30s" },
  home: { method: "GET", path: `${MOBILE_API_PREFIX}/home`, owner: "home aggregation service", auth: "public", cache: "30s" },
  schedule: { method: "GET", path: `${MOBILE_API_PREFIX}/schedule`, owner: "lib/data/lck + tournament filters", auth: "public", cache: "60s" },
  tournaments: { method: "GET", path: `${MOBILE_API_PREFIX}/tournaments`, owner: "lib/data/lck + tournaments", auth: "public", cache: "300s" },
  tournament: { method: "GET", path: `${MOBILE_API_PREFIX}/tournaments/{segment}`, owner: "tournament aggregation service", auth: "public", cache: "300s" },
  predictions: { method: "GET", path: `${MOBILE_API_PREFIX}/predictions`, owner: "lib/predictions", auth: "optional", cache: "30s" },
  predictionPlace: { method: "POST", path: `${MOBILE_API_PREFIX}/predictions`, owner: "lib/predictions", auth: "required", cache: "no-store" },
  predictionCancel: { method: "DELETE", path: `${MOBILE_API_PREFIX}/predictions`, owner: "lib/predictions", auth: "required", cache: "no-store" },
  match: { method: "GET", path: `${MOBILE_API_PREFIX}/matches/{matchId}`, owner: "match aggregation service", auth: "public", cache: "30s" },
  matchLive: { method: "GET", path: `${MOBILE_API_PREFIX}/matches/{matchId}/live`, owner: "lib/lolesports-game-data", auth: "public", cache: "no-store" },
  teams: { method: "GET", path: `${MOBILE_API_PREFIX}/teams`, owner: "lib/data/lck + fan service", auth: "optional", cache: "no-store" },
  team: { method: "GET", path: `${MOBILE_API_PREFIX}/teams/{teamSlug}`, owner: "team aggregation service", auth: "public", cache: "60s" },
  teamCalendarSubmission: { method: "POST", path: `${MOBILE_API_PREFIX}/teams/{teamSlug}/calendar-submissions`, owner: "fan calendar submission service", auth: "required", cache: "no-store" },
  teamFan: { method: "GET", path: `${MOBILE_API_PREFIX}/teams/{teamSlug}/fan`, owner: "fan service", auth: "optional", cache: "no-store" },
  teamFanToggle: { method: "POST", path: `${MOBILE_API_PREFIX}/teams/{teamSlug}/fan`, owner: "fan service", auth: "optional", cache: "no-store" },
  teamFavorite: { method: "POST", path: `${MOBILE_API_PREFIX}/teams/{teamSlug}/favorite`, owner: "favorite team service", auth: "optional", cache: "no-store" },
  teamNotification: { method: "POST", path: `${MOBILE_API_PREFIX}/teams/{teamSlug}/notifications`, owner: "fan notification service", auth: "required", cache: "no-store" },
  players: { method: "GET", path: `${MOBILE_API_PREFIX}/players`, owner: "lib/data/lck", auth: "public", cache: "21600s" },
  player: { method: "GET", path: `${MOBILE_API_PREFIX}/players/{playerSlug}`, owner: "player aggregation service", auth: "public", cache: "300s" },
  champions: { method: "GET", path: `${MOBILE_API_PREFIX}/champions`, owner: "champion aggregation service", auth: "public", cache: "300s" },
  champion: { method: "GET", path: `${MOBILE_API_PREFIX}/champions/{championSlug}`, owner: "champion aggregation service", auth: "public", cache: "300s" },
  news: { method: "GET", path: `${MOBILE_API_PREFIX}/news`, owner: "lib/data/news + lib/data/naver-news", auth: "public", cache: "60s" },
  search: { method: "GET", path: `${MOBILE_API_PREFIX}/search`, owner: "search service", auth: "public", cache: "30s" },
  communityPosts: { method: "GET", path: `${MOBILE_API_PREFIX}/community/posts`, owner: "lib/data/community", auth: "optional", cache: "10s" },
  communityPostCreate: { method: "POST", path: `${MOBILE_API_PREFIX}/community/posts`, owner: "community service", auth: "optional", cache: "no-store" },
  communityPost: { method: "GET", path: `${MOBILE_API_PREFIX}/community/posts/{postId}`, owner: "lib/data/community", auth: "optional", cache: "10s" },
  communityPostUpdate: { method: "PATCH", path: `${MOBILE_API_PREFIX}/community/posts/{postId}`, owner: "community service", auth: "optional", cache: "no-store" },
  communityPostDelete: { method: "DELETE", path: `${MOBILE_API_PREFIX}/community/posts/{postId}`, owner: "community service", auth: "optional", cache: "no-store" },
  communityComments: { method: "POST", path: `${MOBILE_API_PREFIX}/community/comments`, owner: "community service", auth: "optional", cache: "no-store" },
  notifications: { method: "GET", path: `${MOBILE_API_PREFIX}/notifications`, owner: "community notification service", auth: "optional", cache: "no-store" },
  notificationsUpdate: { method: "PATCH", path: `${MOBILE_API_PREFIX}/notifications`, owner: "community notification service", auth: "optional", cache: "no-store" },
  notificationsDelete: { method: "DELETE", path: `${MOBILE_API_PREFIX}/notifications`, owner: "community notification service", auth: "optional", cache: "no-store" },
  communityCommentUpdate: { method: "PATCH", path: `${MOBILE_API_PREFIX}/community/comments/{commentId}`, owner: "community service", auth: "optional", cache: "no-store" },
  communityCommentDelete: { method: "DELETE", path: `${MOBILE_API_PREFIX}/community/comments/{commentId}`, owner: "community service", auth: "optional", cache: "no-store" },
  communityReactions: { method: "POST", path: `${MOBILE_API_PREFIX}/community/reactions`, owner: "community service", auth: "required", cache: "no-store" },
  communityReports: { method: "POST", path: `${MOBILE_API_PREFIX}/community/reports`, owner: "community service", auth: "required", cache: "no-store" },
  communityPoll: { method: "GET", path: `${MOBILE_API_PREFIX}/community/polls/{pollId}`, owner: "community poll service", auth: "optional", cache: "no-store" },
  communityPollVote: { method: "POST", path: `${MOBILE_API_PREFIX}/community/polls/{pollId}`, owner: "community poll service", auth: "optional", cache: "no-store" },
  communityUpload: { method: "POST", path: `${MOBILE_API_PREFIX}/community/upload`, owner: "community upload service", auth: "optional", cache: "no-store" },
  communityUser: { method: "GET", path: `${MOBILE_API_PREFIX}/community/users/{userId}`, owner: "community user activity service", auth: "optional", cache: "no-store" },
  communityAuthorAction: { method: "POST", path: `${MOBILE_API_PREFIX}/community/authors/actions`, owner: "community user actions service", auth: "required", cache: "no-store" },
  authNaverStart: { method: "GET", path: `${MOBILE_API_PREFIX}/auth/naver/start`, owner: "native auth broker", auth: "public", cache: "no-store" },
  authNaverCallback: { method: "GET", path: `${MOBILE_API_PREFIX}/auth/naver/callback`, owner: "native auth broker", auth: "public", cache: "no-store" },
  authNaverExchange: { method: "POST", path: `${MOBILE_API_PREFIX}/auth/naver/exchange`, owner: "native auth broker", auth: "public", cache: "no-store" },
  me: { method: "GET", path: `${MOBILE_API_PREFIX}/me`, owner: "account service", auth: "required", cache: "no-store" },
  meMatchActivity: { method: "GET", path: `${MOBILE_API_PREFIX}/me/match-activity`, owner: "match activity service", auth: "required", cache: "no-store" },
  meProfileUpdate: { method: "POST", path: `${MOBILE_API_PREFIX}/me`, owner: "account profile service", auth: "required", cache: "no-store" },
  meUpdate: { method: "PATCH", path: `${MOBILE_API_PREFIX}/me`, owner: "account service", auth: "required", cache: "no-store" },
  meDelete: { method: "DELETE", path: `${MOBILE_API_PREFIX}/me`, owner: "account security service", auth: "required", cache: "no-store" },
  devices: { method: "POST", path: `${MOBILE_API_PREFIX}/devices`, owner: "push device service", auth: "required", cache: "no-store" },
} as const satisfies Record<string, MobileApiRouteDefinition>;

export type MobileApiAuthMode = MobileApiRouteDefinition["auth"];

const mobileApiRouteMatchers = Object.values(mobileApiRoutes).map((route) => ({
  ...route,
  pattern: new RegExp(`^${route.path
    .split("/")
    .map((segment) => /^\{[^/]+\}$/.test(segment) ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("/")}/?$`),
}));

/** Returns the shared web/app authentication policy for a versioned mobile API request. */
export function mobileApiAuthForRequest(method: MobileApiRouteDefinition["method"], input: string): MobileApiAuthMode | null {
  try {
    const pathname = new URL(input, "https://minion.invalid").pathname;
    return mobileApiRouteMatchers.find((route) => route.method === method && route.pattern.test(pathname))?.auth ?? null;
  } catch {
    return null;
  }
}

export type MobileDockTab = "home" | "matches" | "fan" | "teams" | "news";

export type MobileRouteMatch = {
  screen: string;
  params: Record<string, string>;
  dockTab: MobileDockTab | null;
  hideGlobalDock: boolean;
  focus: boolean;
  fallbackPath?: string;
};

type RouteRule = {
  pattern: RegExp;
  screen: string;
  dockTab: MobileDockTab | null;
  hideGlobalDock?: boolean;
  focus?: boolean;
  fallback?: (params: Record<string, string>) => string;
  keys?: string[];
};

const routeRules: RouteRule[] = [
  { pattern: /^\/$/, screen: "home", dockTab: "home" },
  { pattern: /^\/schedule\/?$/, screen: "schedule", dockTab: "matches" },
  { pattern: /^\/tournaments(?:\/([^/]+))?\/?$/, screen: "tournaments", dockTab: "matches", keys: ["segment"] },
  { pattern: /^\/predictions\/?$/, screen: "predictions", dockTab: "matches" },
  { pattern: /^\/matches\/([^/]+)\/sets\/([^/]+)\/snapshot\/?$/, screen: "rating-snapshot", dockTab: null, hideGlobalDock: true, focus: true, keys: ["matchId", "setId"], fallback: p => `/matches/${encodeURIComponent(p.matchId)}` },
  { pattern: /^\/matches\/([^/]+)\/?$/, screen: "match", dockTab: "matches", keys: ["matchId"] },
  { pattern: /^\/teams\/?$/, screen: "teams", dockTab: "teams" },
  { pattern: /^\/teams\/([^/]+)\/?$/, screen: "team", dockTab: "teams", keys: ["teamSlug"] },
  { pattern: /^\/players\/?$/, screen: "players", dockTab: null },
  { pattern: /^\/players\/([^/]+)\/?$/, screen: "player", dockTab: null, keys: ["playerSlug"] },
  { pattern: /^\/champions\/?$/, screen: "champions", dockTab: null },
  { pattern: /^\/champions\/([^/]+)\/?$/, screen: "champion", dockTab: null, keys: ["championSlug"] },
  { pattern: /^\/search\/?$/, screen: "search", dockTab: null },
  { pattern: /^\/fan\/([^/]+)\/?$/, screen: "fan-home", dockTab: "fan", keys: ["teamSlug"] },
  { pattern: /^\/fan\/([^/]+)\/(schedule|players|social|videos)\/?$/, screen: "fan-section", dockTab: "fan", keys: ["teamSlug", "section"] },
  { pattern: /^\/fan\/([^/]+)\/community\/post\/([^/]+)\/?$/, screen: "community-post", dockTab: "fan", hideGlobalDock: true, keys: ["teamSlug", "postId"] },
  { pattern: /^\/fan\/([^/]+)\/community\/(?:new|[^/]+\/new)\/?$/, screen: "community-compose", dockTab: null, hideGlobalDock: true, focus: true, keys: ["teamSlug"], fallback: p => `/fan/${p.teamSlug}/community` },
  { pattern: /^\/fan\/([^/]+)\/community\/post\/([^/]+)\/edit\/?$/, screen: "community-edit", dockTab: null, hideGlobalDock: true, focus: true, keys: ["teamSlug", "postId"], fallback: p => `/fan/${p.teamSlug}/community/post/${p.postId}` },
  { pattern: /^\/fan\/([^/]+)\/community(?:\/([^/]+))?\/?$/, screen: "fan-community", dockTab: "fan", keys: ["teamSlug", "board"] },
  { pattern: /^\/community\/?$/, screen: "community", dockTab: null },
  { pattern: /^\/community\/post\/([^/]+)\/?$/, screen: "community-post", dockTab: null, hideGlobalDock: true, keys: ["postId"] },
  { pattern: /^\/community\/(?:new|[^/]+\/new)\/?$/, screen: "community-compose", dockTab: null, hideGlobalDock: true, focus: true, fallback: () => "/community" },
  { pattern: /^\/community\/post\/([^/]+)\/edit\/?$/, screen: "community-edit", dockTab: null, hideGlobalDock: true, focus: true, keys: ["postId"], fallback: p => `/community/post/${p.postId}` },
  { pattern: /^\/community\/user\/([^/]+)\/?$/, screen: "community-user", dockTab: null, keys: ["userId"] },
  { pattern: /^\/community\/([^/]+)\/?$/, screen: "community-board", dockTab: null, keys: ["board"] },
  { pattern: /^\/news(?:\/.*)?$/, screen: "news", dockTab: "news" },
  { pattern: /^\/me\/?$/, screen: "me", dockTab: null },
  { pattern: /^\/me\/(profile|settings)\/?$/, screen: "me-focus", dockTab: null, hideGlobalDock: true, focus: true, keys: ["section"], fallback: () => "/me" },
  { pattern: /^\/(login|signup)\/?$/, screen: "auth", dockTab: null, hideGlobalDock: true, focus: true, keys: ["mode"], fallback: p => p.mode === "signup" ? "/login" : "/" },
];

function pathnameFromInput(input: string): string | null {
  try {
    const parsed = new URL(input, "https://minion.example");
    if (parsed.protocol === "minion:" && parsed.hostname === "app") return parsed.pathname || "/";
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.pathname || "/";
    if (!input.includes(":")) return parsed.pathname || "/";
    return null;
  } catch {
    return null;
  }
}

export function matchMobileRoute(input: string): MobileRouteMatch | null {
  const pathname = pathnameFromInput(input);
  if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/reports")) return null;

  for (const rule of routeRules) {
    const match = pathname.match(rule.pattern);
    if (!match) continue;
    const params = Object.fromEntries((rule.keys ?? []).flatMap((key, index) => match[index + 1] ? [[key, decodeURIComponent(match[index + 1])]] : []));
    return {
      screen: rule.screen,
      params,
      dockTab: rule.dockTab,
      hideGlobalDock: rule.hideGlobalDock ?? false,
      focus: rule.focus ?? false,
      ...(rule.fallback ? { fallbackPath: rule.fallback(params) } : {}),
    };
  }
  return null;
}

export function toMobileDeepLink(webPath: string): string | null {
  const pathname = pathnameFromInput(webPath);
  return pathname && matchMobileRoute(pathname) ? `minion://app${pathname}` : null;
}
