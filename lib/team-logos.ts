import type { Team } from "@/lib/types";

export function teamLogoPath(key: string) {
  return `/logos/${key}.svg`;
}

export function teamWhiteLogoPath(key: string) {
  return `/logos/${key}-white.svg`;
}

const COLOR_LOGO_ON_DARK_SLUGS = new Set(["t1", "geng", "fox", "soop"]);
const DEFAULT_WHITE_LOGO_ON_DARK_SLUGS = new Set(["hle", "dk", "kt", "drx", "ns", "bro"]);

export function shouldUseWhiteLogoOnDark(team?: Pick<Team, "slug" | "logoWhiteUrl" | "useWhiteLogoOnDark">) {
  if (!team?.logoWhiteUrl) return false;
  const slug = team.slug.toLowerCase();
  if (COLOR_LOGO_ON_DARK_SLUGS.has(slug)) return false;
  return Boolean(team.useWhiteLogoOnDark) || DEFAULT_WHITE_LOGO_ON_DARK_SLUGS.has(slug);
}
