// 게시판 날짜는 서버와 브라우저의 기본 시간대에 관계없이 한국 시간으로 표시한다.
const TIME_ZONE = "Asia/Seoul";

export function formatCommunityDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("ko-KR", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  });
}

export function formatRelativeOrDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;

  return formatCommunityDate(iso);
}

export function formatListDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const now = new Date();
  const isToday = formatCommunityDate(iso) === formatCommunityDate(now.toISOString());

  if (isToday) {
    return date.toLocaleTimeString("ko-KR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return formatCommunityDate(iso);
}
