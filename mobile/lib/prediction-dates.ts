const KST_OFFSET = 9 * 60 * 60 * 1000;

export function weekStartKey(date: string) {
  const value = new Date(new Date(date).getTime() + KST_OFFSET);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}

export function predictionDateLabel(date: string) {
  return new Intl.DateTimeFormat('ko-KR', { day: 'numeric', month: 'long', timeZone: 'Asia/Seoul', weekday: 'long' }).format(new Date(date));
}

export function predictionTimeLabel(date: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', hour12: false, minute: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(date));
}

export function deadlineLabel(date: string, closed: boolean, now: number) {
  if (closed) return '예측 마감';
  const minutes = Math.max(0, Math.floor((new Date(date).getTime() - now) / 60000));
  if (minutes < 60) return `${minutes}분 남음`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 남음`;
  return `${Math.floor(minutes / 1440)}일 남음`;
}
