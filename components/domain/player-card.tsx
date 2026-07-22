import Link from "next/link";
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

export function PlayerCard({
  player,
  hrefBase = "/players",
  variant = "default",
}: {
  player: Player;
  hrefBase?: string;
  variant?: "default" | "fan";
}) {
  const fanCard = variant === "fan";

  return (
    <Link
      href={`${hrefBase}/${player.slug}`}
      className={`group flex flex-col overflow-hidden border bg-surface transition ${
        fanCard
          ? "fan-player-card rounded-xl border-[var(--ui-border)]"
          : "rounded-md border-border transition-colors hover:border-accent"
      }`}
    >
      <div className={`relative aspect-[4/5] overflow-hidden bg-surface-muted ${fanCard ? "fan-player-card__photo" : ""}`}>
        <PlayerPhoto
          src={player.profileImageUrl}
          alt={player.name}
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className={`absolute left-2 top-2 px-2 py-1 text-[12px] font-black ${fanCard ? "fan-player-position bg-[var(--team-primary)] text-[var(--team-on-primary)]" : "rounded-md bg-background/80 font-semibold text-accent backdrop-blur-sm"}`}>
          {POSITION_LABEL[player.position] ?? player.position}
        </span>
      </div>
      <div className={`flex flex-col gap-1 p-4 ${fanCard ? "fan-player-card__body" : ""}`}>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h2 className={`truncate text-lg font-bold leading-tight group-hover:text-accent ${fanCard ? "text-[var(--ui-ink)] group-hover:text-[var(--team-accent-text)]" : ""}`}>
            {player.name}
          </h2>
          {fanCard && player.isStarter ? <span className="fan-player-stamp shrink-0 text-[10px] font-black text-[var(--team-accent-text)]">STARTER</span> : null}
        </div>
        <p className="truncate text-sm text-muted">{player.realName}</p>
      </div>
    </Link>
  );
}
