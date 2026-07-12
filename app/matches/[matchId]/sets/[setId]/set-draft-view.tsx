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

function DraftTile({
  item,
  muted = false,
}: {
  item: DraftItem | null;
  muted?: boolean;
}) {
  const image = championImage(item?.champion);
  return (
    <div className="relative h-9 overflow-hidden rounded-md border border-border bg-background sm:h-10 lg:h-12">
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
  const orderedBans = [...bans].sort((a, b) => a.orderIndex - b.orderIndex);
  const displayOrderedBans = reverse ? [...orderedBans].reverse() : orderedBans;

  if (mode === "order") {
    return (
      <div className="grid gap-2 lg:gap-2.5">
        <div>
          <div className="mb-1 flex items-center justify-between text-[13px] font-semibold sm:mb-1.5 sm:text-sm">
            <span>{side.teamName} 밴 순서</span>
          </div>
          <div className="grid grid-cols-5 gap-1 lg:gap-1.5">
            {Array.from({ length: 5 }, (_, index) => {
              const item = displayOrderedBans[index] ?? null;
              return (
                <DraftTile key={item?.id ?? `ban-order-${index}`} item={item} muted />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 lg:gap-2.5">
      <div>
        <div className="mb-1 flex items-center justify-between text-[13px] font-semibold sm:mb-1.5 sm:text-sm">
          <span>{side.teamName} 밴</span>
        </div>
        <div className="grid grid-cols-5 gap-1 lg:gap-1.5">
          {Array.from({ length: 5 }, (_, index) => {
            const item = displayOrderedBans[index] ?? null;
            return <DraftTile key={item?.id ?? `ban-${index}`} item={item} muted />;
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
  const [mode] = useState<"line" | "order">("line");

  return (
    <div className="grid gap-2 rounded-md border border-border bg-surface p-2 sm:p-3 lg:gap-3">
      <div className="grid gap-2 md:grid-cols-2 lg:gap-3">
        <DraftGrid side={blue} champions={champions} mode={mode} />
        <DraftGrid side={red} champions={champions} mode={mode} />
      </div>
    </div>
  );
}
