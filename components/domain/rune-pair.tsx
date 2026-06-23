import Image from "next/image";

import { resolveRunePairUrls, type RuneCatalog } from "@/lib/runes";

export function RunePair({
  runeIds,
  catalog,
  size = "md",
  className = "",
}: {
  runeIds: Array<number | null | undefined>;
  catalog: RuneCatalog;
  size?: "sm" | "md";
  className?: string;
}) {
  const { keystoneUrl, treeUrl } = resolveRunePairUrls(runeIds, catalog);
  const mainSize = size === "sm" ? 28 : 32;
  const badgeSize = size === "sm" ? 14 : 16;
  const mainClass = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const badgeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <span className={`relative block shrink-0 ${mainClass} ${className}`}>
      {keystoneUrl ? (
        <Image
          src={keystoneUrl}
          alt=""
          width={mainSize}
          height={mainSize}
          unoptimized
          className={`${mainClass} rounded-full border border-white/10 bg-[#0d1117] object-contain`}
        />
      ) : (
        <span
          className={`block ${mainClass} rounded-full border border-dashed border-border bg-surface-muted`}
          aria-hidden="true"
        />
      )}
      {treeUrl ? (
        <Image
          src={treeUrl}
          alt=""
          width={badgeSize}
          height={badgeSize}
          unoptimized
          className={`absolute -bottom-0.5 -right-0.5 ${badgeClass} rounded-full object-contain ring-1 ring-background`}
        />
      ) : null}
    </span>
  );
}
