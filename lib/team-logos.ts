import type { Team } from "@/lib/types";

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
