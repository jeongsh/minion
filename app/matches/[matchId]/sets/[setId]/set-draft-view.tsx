import Image from "next/image";

import { championImage, championLabel } from "@/lib/champions";
import type { Champion, SetPickBan } from "@/lib/types";

type DraftSide = {
  teamName: string;
  bans: SetPickBan[];
};

type DraftItem = SetPickBan & {
  champion?: Champion;
};

function orderedBans(draft: SetPickBan[], champions: Champion[]) {
  return [...draft]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((item) => ({
      ...item,
      champion: champions.find((champion) => champion.id === item.championId),
    }));
}

function BanTile({ item }: { item: DraftItem | null }) {
  const image = championImage(item?.champion);

  return (
    <span className="relative block h-7 w-12 shrink-0 overflow-hidden rounded-sm bg-surface-muted">
      {image ? (
        <Image
          src={image}
          alt={championLabel(item?.champion)}
          fill
          sizes="48px"
          className="object-cover grayscale"
        />
      ) : null}
    </span>
  );
}

function CompactBanTile({ item }: { item: DraftItem | null }) {
  const image = championImage(item?.champion);

  return (
    <span className="relative block aspect-square min-w-0 overflow-hidden rounded-sm bg-surface-muted sm:aspect-[1.45/1]">
      {image ? (
        <Image
          src={image}
          alt={championLabel(item?.champion)}
          fill
          sizes="(max-width: 480px) 28px, 44px"
          className="object-cover grayscale"
        />
      ) : null}
    </span>
  );
}

function BanTiles({
  items,
  reverse = false,
}: {
  items: DraftItem[];
  reverse?: boolean;
}) {
  return (
    <span className={`flex gap-0.5 min-[360px]:gap-1 ${reverse ? "flex-row-reverse" : ""}`}>
      {Array.from({ length: 5 }, (_, index) => {
        const item = items[index] ?? null;
        return <BanTile key={item?.id ?? `empty-ban-${index}`} item={item} />;
      })}
    </span>
  );
}

export function SetDraftView({
  blue,
  red,
  champions,
}: {
  blue: DraftSide;
  red: DraftSide;
  champions: Champion[];
}) {
  const blueBans = orderedBans(blue.bans, champions);
  const redBans = orderedBans(red.bans, champions);

  return (
    <>
      <div className="grid gap-2 sm:hidden">
        <p className="text-center text-[13px] font-medium text-muted">밴</p>
        <div className="grid min-w-0 gap-1 min-[360px]:flex min-[360px]:items-center min-[360px]:justify-between min-[360px]:gap-2">
          <strong className="min-w-0 truncate text-sm font-semibold">{blue.teamName}</strong>
          <BanTiles items={blueBans} />
        </div>
        <div className="grid min-w-0 gap-1 min-[360px]:flex min-[360px]:items-center min-[360px]:justify-between min-[360px]:gap-2">
          <strong className="min-w-0 truncate text-sm font-semibold">{red.teamName}</strong>
          <BanTiles items={redBans} reverse />
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-3 sm:grid">
        <div
          className="flex min-w-0 items-center justify-end"
          aria-label={`${blue.teamName} 밴`}
        >
          <BanTiles items={blueBans} />
        </div>
        <span className="text-center text-[13px] font-medium text-muted">
          밴
        </span>
        <div
          className="flex min-w-0 items-center"
          aria-label={`${red.teamName} 밴`}
        >
          <BanTiles items={redBans} reverse />
        </div>
      </div>
    </>
  );
}

export function CompactSetDraftView({
  blue,
  red,
  champions,
}: {
  blue: DraftSide;
  red: DraftSide;
  champions: Champion[];
}) {
  const blueBans = orderedBans(blue.bans, champions);
  const redBans = orderedBans(red.bans, champions);

  const tiles = (items: DraftItem[]) => (
    <div className="grid min-w-0 grid-cols-5 gap-0.5 sm:gap-1">
      {Array.from({ length: 5 }, (_, index) => {
        const item = items[index] ?? null;
        return <CompactBanTile key={item?.id ?? `compact-empty-ban-${index}`} item={item} />;
      })}
    </div>
  );

  return (
    <section aria-label="밴">
      <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-center sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)]">
        <div aria-label={`${blue.teamName} 밴`}>{tiles(blueBans)}</div>
        <span className="text-center text-xs font-semibold text-muted">밴</span>
        <div aria-label={`${red.teamName} 밴`}>{tiles(redBans)}</div>
      </div>
    </section>
  );
}
