import Link from "next/link";
import { getTeamById } from "@/lib/team-themes";
import type { Player } from "@/lib/types";

const POSITION_LABEL: Record<string, string> = {
  TOP: "탑",
  JGL: "정글",
  MID: "미드",
  BOT: "원딜",
  SUP: "서폿",
};

function PlayerPhoto({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className: string;
}) {
  if (!src) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-surface-muted text-sm font-semibold text-muted`}
        aria-label={alt}
      >
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}

export function PlayerCard({ player }: { player: Player }) {
  const team = getTeamById(player.teamId);

  return (
    <Link
      href={`/players/${player.slug}`}
      className="group flex flex-col overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-accent hover:bg-surface-muted"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-muted">
        <PlayerPhoto
          src={player.profileImageUrl}
          alt={player.name}
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute left-2 top-2 rounded-md bg-background/80 px-2 py-0.5 text-xs font-semibold text-accent backdrop-blur-sm">
          {POSITION_LABEL[player.position] ?? player.position}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <h2 className="truncate text-lg font-bold leading-tight group-hover:text-accent">
          {player.name}
        </h2>
        <p className="truncate text-sm text-muted">
          {player.realName}
          {player.realName && team?.shortName ? " · " : ""}
          {team?.shortName ?? "소속 미정"}
        </p>
      </div>
    </Link>
  );
}
