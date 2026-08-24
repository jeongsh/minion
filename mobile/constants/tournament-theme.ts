/**
 * 대회 순위표(GroupStandingsTable 등)는 앱 전역 --ui-* 토큰이 아니라 웹 globals.css의
 * 별도 shadcn 스타일 토큰(--foreground/--muted/--border/--surface/--surface-muted)을 쓴다.
 * 라이트 모드에서 --ui-* 값과 미묘하게 다르므로(다크는 우연히 동일) 별도로 옮겨둔다.
 */
export type TournamentTokens = { foreground: string; muted: string; border: string; surface: string; surfaceMuted: string };

export const tournamentTokens = {
  light: {
    foreground: '#111827',
    muted: '#667085',
    border: '#d8dee9',
    surface: '#ffffff',
    surfaceMuted: '#eef2f7',
  },
  dark: {
    foreground: '#f8f8f8',
    muted: '#8f98a8',
    border: '#383c44',
    surface: '#141517',
    surfaceMuted: '#1c1e22',
  },
} as const;
