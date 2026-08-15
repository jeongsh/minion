import Link from "next/link";
import type { Player } from "@/lib/types";

const POSITION_LABEL: Record<string, string> = {
  TOP: "탑",
  JGL: "정글",
  MID: "미드",
  BOT: "원딜",
  SUP: "서포터",
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
  teamLabel,
  variant = "default",
}: {
  player: Player;
  hrefBase?: string;
  teamLabel?: string;
  variant?: "default" | "fan";
}) {
  const fanCard = variant === "fan";
  const meta = fanCard
    ? `${teamLabel ?? "FA"}${player.realName ? ` · ${player.realName}` : ""}`
    : player.realName || "프로필 준비 중";

  return (
    <Link
      href={`${hrefBase}/${player.slug}`}
      className={`group min-w-0 overflow-hidden border bg-surface ${
        fanCard
          ? "rounded-2xl border-[var(--ui-border)] bg-[var(--ui-surface)]"
          : "rounded-md border-border transition-colors hover:border-accent"
      }`}
    >
      <div className={`relative aspect-[4/5] overflow-hidden ${fanCard ? "bg-[var(--ui-card-bg)]" : "bg-surface-muted"}`}>
        <PlayerPhoto
          src={player.profileImageUrl}
          alt={player.name}
          className={`h-full w-full object-cover object-top transition-transform group-hover:scale-[1.03] ${fanCard ? "" : "duration-300"}`}
        />
        <span className={fanCard ? "absolute left-2 top-2 rounded-lg bg-black/65 px-2 py-1 text-[11px] font-medium text-white" : "absolute left-2.5 top-2.5 rounded-md bg-background/80 px-2.5 py-1 text-[12px] font-medium text-accent backdrop-blur-sm"}>
          {fanCard ? player.position : (POSITION_LABEL[player.position] ?? player.position)}
        </span>
      </div>
      <div className={fanCard ? "p-3" : "flex flex-col gap-1 p-4"}>
        <h2 className={fanCard ? "truncate text-[16px] font-black text-[var(--ui-ink)]" : "truncate text-lg font-bold leading-tight group-hover:text-accent"}>
          {player.name}
        </h2>
        <p className={fanCard ? "mt-0.5 truncate text-[13px] font-semibold text-[var(--ui-muted)]" : "truncate text-sm text-muted"}>{meta}</p>
      </div>
    </Link>
  );
}
