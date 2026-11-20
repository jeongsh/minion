import type { Team } from "@/lib/types";

export const TEAM_LOGO_MAX_BYTES = 768 * 1024;
export const TEAM_LOGO_FILE_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

export function teamLogoPath(key: string) {
  return `/logos/${key}.svg`;
}

export function teamWhiteLogoPath(key: string) {
  return `/logos/${key}-white.svg`;
}

export function shouldUseWhiteLogoOnDark(team?: Pick<Team, "slug" | "logoWhiteUrl" | "useWhiteLogoOnDark">) {
  if (!team?.logoWhiteUrl) return false;
  return Boolean(team.useWhiteLogoOnDark);
}
