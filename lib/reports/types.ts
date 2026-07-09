// 주간 AI 리포트 콘텐츠 구조.
// weekly_reports.content(jsonb)에 그대로 저장되며, 페이지에서 조인 없이 렌더링할 수 있도록
// 팀/선수/챔피언 정보를 비정규화해 담는다. 수치는 전부 DB에서 집계한 값이고
// AI는 내러티브(리뷰·티어 판정·예측 근거)만 작성한다.

export type ReportTeamRef = {
  slug: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  logoWhiteUrl: string | null;
  color: string;
};

export type ReportChampionStat = {
  slug: string;
  name: string;
  imageUrl: string | null;
  position: string | null;
  picks: number;
  bans: number;
  wins: number;
  losses: number;
  winRate: number; // 0~1, 픽 기준
  presenceRate: number; // 0~1, (픽+밴)/세트
  // 챔피언 경기 지표(픽된 세트 평균) — 티어 판정 근거
  kda: number | null;
  avgDpm: number | null;
  avgGd15: number | null; // 15분 골드 차이
  // 스탯 점수(0~100): KDA·15분 골드차 정규화 평균. 종합 점수 = 밴픽률 30% + 보정승률 40% + 스탯 30%.
  statScore: number | null;
  score: number | null;
};

export type ReportStatLeader = {
  key: string;
  label: string;
  unit: string;
  value: string;
  playerName: string;
  playerSlug: string | null;
  playerImageUrl: string | null;
  position: string;
  team: ReportTeamRef | null;
  championNames: string[];
  runnersUp: Array<{ playerName: string; teamShort: string; value: string }>;
};

export type ReportMatchResult = {
  matchId: string;
  date: string; // ISO
  tournament: string | null;
  teamA: ReportTeamRef | null;
  teamB: ReportTeamRef | null;
  scoreA: number;
  scoreB: number;
  winnerSlug: string | null;
};

export type ReportUpcomingMatch = {
  matchId: string;
  date: string; // ISO
  tournament: string | null;
  teamA: ReportTeamRef | null;
  teamB: ReportTeamRef | null;
  bestOf: number | null;
  // AI 예측
  pickTeamSlug: string;
  confidence: number; // 55~90
  reasoning: string;
  keyPoint: string;
};

export type ReportPositionMeta = {
  position: "TOP" | "JGL" | "MID" | "BOT" | "SUP";
  comment: string;
  sTier: string[]; // champion slugs
  aTier: string[];
  bTier: string[];
  rising: string | null;
};

export type WeeklyReportContent = {
  headline: string;
  subtitle: string;
  overview: string[];
  stats: {
    matchCount: number;
    setCount: number;
    patches: string[];
    avgGameMinutes: number | null;
    matches: ReportMatchResult[];
    champions: ReportChampionStat[]; // presence 내림차순
    statLeaders: ReportStatLeader[];
    teamWeekly: Array<{ team: ReportTeamRef; wins: number; losses: number; setWins: number; setLosses: number }>;
  };
  review: {
    teamOfWeek: { team: ReportTeamRef | null; title: string; body: string };
    playersOfWeek: Array<{
      playerName: string;
      playerSlug: string | null;
      playerImageUrl: string | null;
      position: string;
      team: ReportTeamRef | null;
      championNames: string[];
      body: string;
    }>;
  };
  meta: {
    summary: string[];
    positions: ReportPositionMeta[];
    banSpotlight: { championSlug: string; comment: string } | null;
    // 웹 검색(커뮤니티·전문가·기사)에서 참고한 자료. 구버전 리포트에는 없을 수 있다.
    sources?: Array<{ title: string; url: string }>;
  };
  preview: {
    intro: string;
    matches: ReportUpcomingMatch[];
  };
};

export type WeeklyReportRow = {
  id: string;
  week_key: string;
  title: string;
  period_start: string;
  period_end: string;
  patches: string[];
  status: string;
  content: WeeklyReportContent;
  model: string | null;
  generated_at: string;
};
