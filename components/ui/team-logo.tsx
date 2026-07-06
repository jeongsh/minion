import type { Team } from "@/lib/types";

type TeamLogoProps = {
  team?: Team;
  size?: string;
  plain?: boolean;
  themeAware?: boolean;
};

export function TeamLogo({ team, size="h-10 w-10", plain=false, themeAware=false }: TeamLogoProps) {
  const imageClassName = plain ? "h-full w-full object-contain" : "h-[72%] w-[72%] object-contain";

  return (
    <span className={`grid ${size} shrink-0 place-items-center overflow-hidden ${plain ? "" : "rounded-full bg-[var(--ui-surface-muted)]"}`}>
      {team?.logoUrl ? (
        themeAware && team.logoWhiteUrl ? (
          <>
            <img src={team.logoUrl} alt={team.name} className={`${imageClassName} dark:hidden`} />
            <img src={team.logoWhiteUrl} alt="" aria-hidden="true" className={`${imageClassName} hidden dark:block`} />
          </>
        ) : (
          <img src={team.logoUrl} alt={team.name} className={imageClassName} />
        )
      ) : (
        <span className="text-xs font-black">{team?.shortName ?? "?"}</span>
      )}
    </span>
  );
}

