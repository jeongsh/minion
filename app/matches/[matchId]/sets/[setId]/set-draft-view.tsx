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
    <div className="relative h-24 overflow-hidden rounded-md border border-border bg-background">
      {image ? (
        <Image
          src={image}
          alt={championLabel(item?.champion)}
          fill
          sizes="(max-width: 1024px) 20vw, 8vw"
          className={`object-cover ${muted ? "grayscale" : ""}`}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      {muted ? <div className="absolute inset-x-2 top-1/2 h-px rotate-[-18deg] bg-white/80" /> : null}
      <div
        className={`relative z-10 flex h-full flex-col justify-end p-2 text-white ${
          align === "right" ? "items-end text-right" : ""
        }`}
      >
        <p className="text-xs font-semibold text-white/75">{label ?? ""}</p>
        <p className="line-clamp-1 text-sm font-semibold">{item ? championLabel(item.champion) : "미입력"}</p>
        {subLabel ? <p className="line-clamp-1 text-xs text-white/75">{subLabel}</p> : null}
      </div>
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
            <span className="text-muted">BAN</span>
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
        <div>
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            <span>{side.teamName} 픽 순서</span>
            <span className="text-muted">PICK</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, index) => {
              const item = displayOrderedPicks[index] ?? null;
              return (
                <DraftTile
                  key={item?.id ?? `pick-order-${index}`}
                  item={item}
                  label={item ? `${orderNumber(item, orderedPicks)}번 픽` : `${index + 1}번 픽`}
                  subLabel={item ? undefined : ""}
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
          <span className="text-muted">BAN</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }, (_, index) => {
            const item = displayOrderedBans[index] ?? null;
            const banNumber = item ? orderedBans.findIndex((b) => b.id === item.id) + 1 : null;
            return <DraftTile key={item?.id ?? `ban-${index}`} item={item} muted label={banNumber ? `ban${banNumber}` : ""} />;
          })}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span>{side.teamName} 라인별 픽</span>
          <span className="text-muted">PICK</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {displayLineEntries.map(({ line, item }) => {
            return (
              <DraftTile
                key={item?.id ?? `pick-${line.position}`}
                item={item}
                label={line.position}
                subLabel={line.player?.name}
              />
            );
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">밴픽</h2>
        <div className="inline-flex rounded-md border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => setMode("line")}
            className={`rounded px-3 py-1.5 text-sm font-semibold ${
              mode === "line" ? "bg-foreground text-background" : "text-muted"
            }`}
          >
            라인별
          </button>
          <button
            type="button"
            onClick={() => setMode("order")}
            className={`rounded px-3 py-1.5 text-sm font-semibold ${
              mode === "order" ? "bg-foreground text-background" : "text-muted"
            }`}
          >
            순서별
          </button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DraftGrid side={blue} champions={champions} mode={mode} reverse />
        <DraftGrid side={red} champions={champions} mode={mode} />
      </div>
    </div>
  );
}
