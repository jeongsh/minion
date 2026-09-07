export const FAVORITE_TEAM_COOLDOWN_DAYS = 7;
export const FAVORITE_TEAM_COOLDOWN_MS = FAVORITE_TEAM_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export function activeFavoriteTeamCooldown(
  availableAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!availableAt) return null;
  const timestamp = new Date(availableAt).getTime();
  return Number.isFinite(timestamp) && timestamp > now ? new Date(timestamp).toISOString() : null;
}

export function nextFavoriteTeamChangeAvailableAt(now = Date.now()): string {
  return new Date(now + FAVORITE_TEAM_COOLDOWN_MS).toISOString();
}

export function formatFavoriteTeamChangeTime(availableAt: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(availableAt));
}

export function favoriteTeamCooldownMessage(availableAt: string): string {
  return `${formatFavoriteTeamChangeTime(availableAt)}까지 최애팀을 선택·변경·해제할 수 없습니다.`;
}

export function favoriteTeamConfirmationMessage(teamName: string, nextFavorite: boolean): string {
  return nextFavorite
    ? `${teamName}을 최애팀으로 설정할까요?\n\n설정 후 7일 동안 최애팀을 변경하거나 해제할 수 없습니다.`
    : `최애팀 설정을 해제할까요?\n\n해제 후 7일 동안 다른 최애팀을 선택할 수 없습니다.`;
}

export function favoriteTeamCooldownFromError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const value = error as { message?: unknown; details?: unknown };
  if (value.message !== "FAVORITE_TEAM_CHANGE_COOLDOWN" || typeof value.details !== "string") return null;
  return activeFavoriteTeamCooldown(value.details);
}
