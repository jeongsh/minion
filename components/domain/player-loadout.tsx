import Image from "next/image";
import type { ReactNode } from "react";

import { championImage, championLabel } from "@/lib/champions";
import { spellImageUrlById, type GameSpell } from "@/lib/spells";
import type { Champion } from "@/lib/types";
import { RunePair } from "./rune-pair";
import type { RuneCatalog } from "@/lib/runes";

const EMPTY_RUNE_CATALOG: RuneCatalog = { keystones: [], trees: [] };

function ResolvedRunePair({ urls, size }: { urls: [string, string]; size: "sm" | "md" }) {
  const mainClass = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const badgeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <span className={`relative block shrink-0 ${mainClass}`}>
      {urls[0] ? (
        <Image src={urls[0]} alt="" fill sizes={size === "sm" ? "28px" : "32px"} unoptimized className="rounded-full border border-white/10 bg-[#0d1117] object-contain" />
      ) : (
        <span className={`block rounded-full border border-dashed border-border bg-surface-muted ${mainClass}`} />
      )}
      {urls[1] ? (
        <Image src={urls[1]} alt="" width={size === "sm" ? 14 : 16} height={size === "sm" ? 14 : 16} unoptimized className={`absolute -bottom-0.5 -right-0.5 rounded-full object-contain ring-1 ring-background ${badgeClass}`} />
      ) : null}
    </span>
  );
}

function SpellIcon({ src, size }: { src: string; size: "sm" | "md" }) {
  const className = size === "sm" ? "h-5 w-5" : "h-8 w-8";

  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-sm border border-border/60 bg-surface-muted ${className}`}>
      {src ? <Image src={src} alt="" fill sizes={size === "sm" ? "20px" : "32px"} className="object-cover" /> : null}
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
}) {
  const image = championImage(champion);
  const championSize = size === "sm" ? "h-11 w-11" : "h-12 w-12";
  const spell0Url = spellImageUrlById(spells, spellIds[0], version);
  const spell1Url = spellImageUrlById(spells, spellIds[1], version);

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span className={`relative block shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted ${championSize}`}>
        {image ? <Image src={image} alt={championLabel(champion)} fill sizes={size === "sm" ? "44px" : "48px"} className="object-cover" /> : null}
        {badge ? <span className="absolute bottom-0 right-0 rounded-tl bg-background/90 px-1 text-xs font-semibold">{badge}</span> : null}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        <span className="flex flex-col gap-1">
          <SpellIcon src={spell0Url} size={size} />
          <SpellIcon src={spell1Url} size={size} />
        </span>
        {runeImageUrls ? <ResolvedRunePair urls={runeImageUrls} size={size} /> : <RunePair runeIds={runeIds} catalog={runeCatalog} size={size} />}
      </span>

      {primaryLabel != null || secondaryLabel != null ? (
        <span className="min-w-0">
          {primaryLabel != null ? <span className="block truncate text-sm font-semibold">{primaryLabel}</span> : null}
          {secondaryLabel != null ? <span className="block truncate text-xs text-muted">{secondaryLabel}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
