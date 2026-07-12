import Image from "next/image";
import type { ReactNode } from "react";

import { championImage, championLabel } from "@/lib/champions";
import { spellImageUrlById, type GameSpell } from "@/lib/spells";
import type { Champion, PlayerPosition } from "@/lib/types";
import { resolveRunePairUrls, type RuneCatalog } from "@/lib/runes";

const EMPTY_RUNE_CATALOG: RuneCatalog = { keystones: [], trees: [] };
const POSITION_ICON_BY_POSITION: Record<PlayerPosition, string> = {
  TOP: "/objectives/position-top.svg",
  JGL: "/objectives/position-jungle.svg",
  MID: "/objectives/position-middle.svg",
  BOT: "/objectives/position-bottom.svg",
  SUP: "/objectives/position-utility.svg",
};

function RuneIcon({ src, size, isTree = false }: { src: string; size: "sm" | "md"; isTree?: boolean }) {
  const className = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const imageSize = size === "sm" ? "20px" : "24px";

  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full bg-[#0d1117] ${className} ${
        isTree ? "" : "border border-white/10"
      }`}
    >
      {src ? <Image src={src} alt="" fill sizes={imageSize} unoptimized className={`object-contain ${isTree ? "scale-[0.72]" : ""}`} /> : null}
    </span>
  );
}

function SpellIcon({ src, size }: { src: string; size: "sm" | "md" }) {
  const className = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-sm border border-border/60 bg-surface-muted ${className}`}>
      {src ? <Image src={src} alt="" fill sizes={size === "sm" ? "20px" : "24px"} className="object-cover" /> : null}
    </span>
  );
}

export function PlayerLoadout({
  champion,
  spellIds,
  runeIds,
  spells,
  version,
  runeCatalog = EMPTY_RUNE_CATALOG,
  runeImageUrls,
  primaryLabel,
  secondaryLabel,
  badge,
  size = "md",
  className = "",
  position,
}: {
  champion?: Champion;
  spellIds: Array<number | null | undefined>;
  runeIds: Array<number | null | undefined>;
  spells: GameSpell[];
  version: string;
  runeCatalog?: RuneCatalog;
  runeImageUrls?: [string, string];
  primaryLabel?: ReactNode;
  secondaryLabel?: ReactNode;
  badge?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  position?: PlayerPosition;
}) {
  const image = championImage(champion);
  const championSize = size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const championImageSize = size === "sm" ? "40px" : "48px";
  const positionIconSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const positionIconImageSize = size === "sm" ? "20px" : "24px";
  const positionIcon = position ? POSITION_ICON_BY_POSITION[position] : null;
  const spell0Url = spellImageUrlById(spells, spellIds[0], version);
  const spell1Url = spellImageUrlById(spells, spellIds[1], version);
  const resolvedRunePair = resolveRunePairUrls(runeIds, runeCatalog);
  const resolvedRuneUrls = runeImageUrls ?? [resolvedRunePair.keystoneUrl, resolvedRunePair.treeUrl];

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span className="flex shrink-0 items-center gap-1">
        {positionIcon ? (
          <span className={`relative block shrink-0 ${positionIconSize}`}>
            <Image src={positionIcon} alt="" fill sizes={positionIconImageSize} className="object-contain" />
          </span>
        ) : null}
        <span className={`relative block shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted ${championSize}`}>
          {image ? <Image src={image} alt={championLabel(champion)} fill sizes={championImageSize} className="object-cover" /> : null}
          {badge ? <span className="absolute bottom-0 right-0 rounded-tl bg-background/90 px-0.5 text-[9px] font-semibold leading-3">{badge}</span> : null}
        </span>

        <span className="flex shrink-0 items-center gap-0">
          <span className="flex flex-col gap-0">
            <SpellIcon src={spell0Url} size={size} />
            <SpellIcon src={spell1Url} size={size} />
          </span>
          <span className="flex flex-col gap-0">
            <RuneIcon src={resolvedRuneUrls[0]} size={size} />
            <RuneIcon src={resolvedRuneUrls[1]} size={size} isTree />
          </span>
        </span>
      </span>

      {primaryLabel != null || secondaryLabel != null ? (
        <span className="min-w-0">
          {primaryLabel != null ? <span className="block truncate text-sm font-semibold">{primaryLabel}</span> : null}
          {secondaryLabel != null ? <span className="block truncate text-[13px] text-muted">{secondaryLabel}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
