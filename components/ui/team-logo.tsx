import type { Team } from "@/lib/types";

type TeamLogoProps = {
  team?: Team;
  size?: string;
  plain?: boolean;
  themeAware?: boolean;
  imageClassName?: string;
};

export function TeamLogo({ team, size="h-10 w-10", plain=false, themeAware=false, imageClassName }: TeamLogoProps) {
  const logoImageClassName = imageClassName ?? (plain ? "h-full w-full object-contain" : "h-[72%] w-[72%] object-contain");

  // 다크모드에서 컬러 로고(특히 화이트 로고를 구할 수 없는 해외팀)가 어두운 배경에 묻히는 문제를,
  // 화이트 로고 스왑 대신 로고 뒤 밝은색 원으로 통일해서 해결한다. 라이트모드는 기존 그대로 유지.
  const themeAwareBg = themeAware
    ? plain
      ? "dark:rounded-full dark:bg-white dark:p-1"
      : "dark:bg-white"
    : "";

  return (
    <span className={`grid ${size} shrink-0 place-items-center overflow-hidden ${plain ? "" : "rounded-full bg-[var(--ui-surface-muted)]"} ${themeAwareBg}`}>
      {team?.logoUrl ? (
        <img src={team.logoUrl} alt={team.name} className={logoImageClassName} />
      ) : (
        <span className="text-[13px] font-black">{team?.shortName ?? "?"}</span>
      )}
    </span>
  );
}
