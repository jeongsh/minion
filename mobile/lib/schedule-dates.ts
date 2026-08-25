const KST_TIMEZONE = 'Asia/Seoul';

function partsOf(value: string | Date, options: Intl.DateTimeFormatOptions) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-CA', { timeZone: KST_TIMEZONE, ...options }).formatToParts(date);
}

export function dateKeyKST(value: string | Date) {
  const parts = partsOf(value, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function formatTimeKST(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', hour12: false, minute: '2-digit', timeZone: KST_TIMEZONE }).format(new Date(value));
}

export function getMonthKST(value: string) {
  return Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: KST_TIMEZONE }).format(new Date(value)));
}

export function getYearKST(value: string) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: KST_TIMEZONE, year: 'numeric' }).format(new Date(value)));
}

export function currentKSTMonthYear() {
  const now = new Date();
  return {
    month: Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: KST_TIMEZONE }).format(now)),
    year: Number(new Intl.DateTimeFormat('en-US', { timeZone: KST_TIMEZONE, year: 'numeric' }).format(now)),
  };
}

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export type WeekDate = { day: number; key: string; weekday: string };

export function weekDatesKST(): WeekDate[] {
  // 기기 로컬 타임존이 KST가 아니면 today.getDay()/getDate()가 실제 KST 날짜와
  // 어긋날 수 있어, KST 달력 날짜를 먼저 구한 뒤 UTC 기준으로만 날짜 연산을 한다.
  const [year, month, day] = dateKeyKST(new Date()).split('-').map(Number);
  const today = new Date(Date.UTC(year, month - 1, day));
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return { day: date.getUTCDate(), key: dateKeyKST(date), weekday: WEEKDAY_LABELS[index] };
  });
}

export function dateHeadingKST(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { day: 'numeric', month: 'long', timeZone: KST_TIMEZONE, weekday: 'long' }).format(new Date(value));
}

type MatchDisplayState = { bestOf: number | null; status: string; teamAScore: number | null; teamBScore: number | null; winnerTeamId: string | null };

/** 승부가 결정됐는데 동기화가 늦어 status가 아직 live인 경우까지 종료로 본다. 웹 lib/match-display.ts와 동일한 판정. */
export function isMatchFinished(match: MatchDisplayState) {
  if (match.status === 'completed' || match.winnerTeamId) return true;
  if (!match.bestOf || match.teamAScore == null || match.teamBScore == null) return false;
  const winsNeeded = Math.floor(match.bestOf / 2) + 1;
  return Math.max(match.teamAScore, match.teamBScore) >= winsNeeded;
}

export function isMatchLive(match: MatchDisplayState) {
  return match.status === 'live' && !isMatchFinished(match);
}

export function matchStatusLabel(status: string) {
  if (status === 'completed') return '종료';
  if (status === 'live') return '진행 중';
  return '예정';
}
