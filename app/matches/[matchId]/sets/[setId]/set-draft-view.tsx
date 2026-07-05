"use client";

import { useState } from "react";
import Image from "next/image";

import { championImage, championLabel } from "@/lib/champions";
import type { Champion, Player, SetPickBan } from "@/lib/types";

type DraftSide = {
  teamName: string;
  bans: SetPickBan[];
  picks: SetPickBan[];
  linePicks: Array<SetPickBan | null>;
  lineup: Array<{ position: Player["position"]; player?: Player }>;
};

type DraftItem = SetPickBan & {
  champion?: Champion;
};

function draftWithChampion(draft: SetPickBan[], champions: Champion[]) {
  return draft.map((item) => ({
    ...item,
    champion: champions.find((champion) => champion.id === item.championId),
  }));
}

function orderNumber(item: SetPickBan, items: SetPickBan[]) {
  return items.findIndex((draft) => draft.id === item.id) + 1;
}

function DraftTile({
  item,
  label,
  subLabel,
  muted = false,
  align = "left",
}: {
  item: DraftItem | null;
  label?: string;
  subLabel?: string;
  muted?: boolean;
  align?: "left" | "right";
}) {
  const image = championImage(item?.champion);
  return (
    <div className="relative h-16 overflow-hidden rounded-md border border-border bg-background">
      {image ? (
        <Image
          src={image}
          alt={championLabel(item?.champion)}
          fill
          className={`object-cover ${muted ? "grayscale" : ""}`}
        />
      ) : null}
    </div>
  );
}

function DraftGrid({
  side,
  champions,
  mode,
  reverse = false,
}: {
  side: DraftSide;
  champions: Champion[];
  mode: "line" | "order";
  reverse?: boolean;
}) {
  const bans = draftWithChampion(side.bans, champions);
  const picks = draftWithChampion(side.picks, champions);
  const orderedBans = [...bans].sort((a, b) => a.orderIndex - b.orderIndex);
  const orderedPicks = [...picks].sort((a, b) => a.orderIndex - b.orderIndex);
  const displayBans = reverse ? [...bans].reverse() : bans;
  const displayOrderedBans = reverse ? [...orderedBans].reverse() : orderedBans;
  const displayOrderedPicks = reverse ? [...orderedPicks].reverse() : orderedPicks;
  const lineEntries = side.lineup.map((line, index) => {
    const item = side.linePicks[index]
      ? {
          ...side.linePicks[index],
          champion: champions.find((champion) => champion.id === side.linePicks[index]?.championId),
        }
      : null;
    return { line, item };
  });
  const displayLineEntries = reverse ? [...lineEntries].reverse() : lineEntries;

  if (mode === "order") {
    return (
      <div className="grid gap-3">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            <span>{side.teamName} 밴 순서</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, index) => {
              const item = displayOrderedBans[index] ?? null;
              return (
                <DraftTile
                  key={item?.id ?? `ban-order-${index}`}
                  item={item}
                  muted
                  label={item ? `${orderNumber(item, orderedBans)}번 밴` : `${index + 1}번 밴`}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span>{side.teamName} 밴</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }, (_, index) => {
            const item = displayOrderedBans[index] ?? null;
            const banNumber = item ? orderedBans.findIndex((b) => b.id === item.id) + 1 : null;
            return <DraftTile key={item?.id ?? `ban-${index}`} item={item} muted label={banNumber ? `ban${banNumber}` : ""} />;
          })}
        </div>
      </div>
    </div>
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
  const [mode, setMode] = useState<"line" | "order">("line");

  return (
    <div className="grid gap-4 rounded-md border border-border bg-surface p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <DraftGrid side={blue} champions={champions} mode={mode} />
        <DraftGrid side={red} champions={champions} mode={mode} />
      </div>
    </div>
  );
}
