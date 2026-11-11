/** 비율을 공개하는 최소 표본. 이보다 적으면 화면은 비율 대신 건수만 보여준다. */
export const RECORD_MIN_SAMPLE = 5;

export type RateRecord = { wins: number; games: number };

/** 팀 기준 시리즈 스코어 한 종류. label은 "2:0"처럼 자기 팀 점수가 앞이다. */
export type SeriesOutcome = { label: string; win: boolean; count: number };

export const FIRST_OBJECTIVE_KEYS = ["kill", "tower", "herald", "baron"] as const;
export type FirstObjectiveKey = typeof FIRST_OBJECTIVE_KEYS[number];
export const FIRST_OBJECTIVE_LABELS: Record<FirstObjectiveKey, string> = { kill: "첫 킬", tower: "첫 타워", herald: "첫 전령", baron: "첫 바론" };

export type PreviewTeamRecord = {
  teamId: string;
  /** 최근 매치 승패. 오래된 경기부터 최신 순이다. */
  form: Array<"W" | "L">;
  /** form과 같은 최근 매치의 세트 득실. */
  recentSets: RateRecord;
  /** 이번 경기와 같은 BO로 치른 시즌 매치 수. outcomes의 분모다. */
  seriesMatches: number;
  outcomes: SeriesOutcome[];
  /** 시즌 다전제의 1세트 승패. */
  firstSet: RateRecord;
  /** 1세트를 이긴 시즌 다전제의 시리즈 승패. */
  afterFirstSetWin: RateRecord;
  /** 아래 두 평균은 브리핑 차트와 같은 최근 세트 표본을 쓴다. */
  averageMinutes: number | null;
  averageTotalKills: number | null;
  sampleSets: number;
  /** 같은 표본에서 오브젝트를 먼저 가져간 비율. 분모는 누군가 그 오브젝트를 가져간 세트다. */
  firsts: Record<FirstObjectiveKey, RateRecord>;
};

export type PreviewHeadToHead = { matches: number; winsA: number; winsB: number; setWinsA: number; setWinsB: number };

export function recordRate(record: RateRecord, minimum = RECORD_MIN_SAMPLE) {
  return record.games >= minimum ? Math.round(record.wins / record.games * 100) : null;
}

/** 평균 경기 시간(분)을 "32:15"처럼 쓴다. */
export function recordMinuteLabel(value: number | null) {
  if (value == null) return "-";
  const seconds = Math.round(value * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
