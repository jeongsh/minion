import type { Team } from "@/lib/types";

type TeamLogoProps = {
  team?: Team;
  size?: string;
  plain?: boolean;
  themeAware?: boolean;
  imageClassName?: string;
};

export function TeamLogo({ team, size = "h-10 w-10", plain = false, themeAware = false, imageClassName }: TeamLogoProps) {
  const logoImageClassName = imageClassName ?? (plain ? "h-full w-full object-contain" : "h-[72%] w-[72%] object-contain");
  const useWhiteLogoOnDark = themeAware && Boolean(team?.useWhiteLogoOnDark && team.logoWhiteUrl);

  return (
    <span className={`grid ${size} shrink-0 place-items-center overflow-hidden ${plain ? "" : "rounded-full bg-[var(--ui-surface-muted)]"}`}>
      {team?.logoUrl ? (
        <>
          <img src={team.logoUrl} alt={team.name} className={`${logoImageClassName} ${useWhiteLogoOnDark ? "dark:hidden" : ""}`} />
          {useWhiteLogoOnDark ? (
            <img src={team.logoWhiteUrl} alt={team.name} className={`${logoImageClassName} hidden dark:block`} />
          ) : null}
        </>
      ) : (
        <span className="text-[13px] font-black">{team?.shortName ?? "?"}</span>
      )}
    </span>
  );
}
