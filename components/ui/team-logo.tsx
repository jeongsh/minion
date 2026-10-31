import type { Team } from "@/lib/types";
import { shouldUseWhiteLogoOnDark } from "@/lib/team-logos";

type TeamLogoProps = {
  team?: Pick<Team, "name" | "slug" | "logoUrl" | "logoWhiteUrl" | "useWhiteLogoOnDark">;
  size?: string;
  plain?: boolean;
  themeAware?: boolean;
  darkSurface?: boolean;
  imageClassName?: string;
};

export function TeamLogo({ team, size = "h-10 w-10", plain = false, themeAware = false, darkSurface = false, imageClassName }: TeamLogoProps) {
  const logoImageClassName = imageClassName ?? (plain ? "h-full w-full object-contain" : "h-[72%] w-[72%] object-contain");
  const useWhiteLogoOnDark = themeAware && shouldUseWhiteLogoOnDark(team);
  const lightLogo = darkSurface && team?.logoWhiteUrl ? team.logoWhiteUrl : team?.logoUrl;
  const darkLogo = useWhiteLogoOnDark ? team?.logoWhiteUrl : team?.logoUrl;
  const hasThemeVariant = themeAware && lightLogo !== darkLogo;
  const hasLogo = Boolean(team?.logoUrl);
  const containerClassName = hasLogo
    ? plain
      ? ""
      : "rounded-full bg-[var(--ui-surface-muted)]"
    : "rounded-md border border-dashed border-[var(--ui-muted)] opacity-60";

  return (
    <span
      className={`grid ${size} shrink-0 place-items-center overflow-hidden ${containerClassName}`}
      role={hasLogo ? undefined : "img"}
      aria-label={hasLogo ? undefined : team?.name ?? "미정 팀"}
    >
      {team?.logoUrl ? (
        <>
          <img src={lightLogo} alt={team.name} loading="lazy" decoding="async" className={`${logoImageClassName} ${hasThemeVariant ? "dark:hidden" : ""}`} />
          {hasThemeVariant ? (
            <img src={darkLogo} alt={team.name} loading="lazy" decoding="async" className={`${logoImageClassName} hidden dark:block`} />
          ) : null}
        </>
      ) : null}
    </span>
  );
}
