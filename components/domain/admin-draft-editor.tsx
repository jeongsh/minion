"use client";

import { useEffect, useMemo, useState } from "react";

import { ChampionPicker } from "@/components/domain/champion-picker";
import {
  banPickSlotNumber,
  buildDraftSlots,
  draftSlotFormIndex,
  lineDisplayChampionId,
  linePickFormIndex,
  orderPickSlotNumber,
  type DraftSlot,
} from "@/lib/draft-slots";
import type { Champion, Player, SetPickBan, SetResult } from "@/lib/types";

type DraftSide = {
  teamName: string;
  teamId: string;
  bans: SetPickBan[];
  picks: SetPickBan[];
  linePicks: Array<SetPickBan | null>;
  lineup: Array<{ position: Player["position"]; player?: Player }>;
};

function orderNumber(item: SetPickBan, items: SetPickBan[]) {
  return items.findIndex((draft) => draft.id === item.id) + 1;
}


function DraftSlotPicker({
  formIndex,
  championId,
  onChampionChange,
  champions,
  align,
  label,
  subLabel,
  muted,
}: {
  formIndex: number;
  championId: string;
  onChampionChange: (formIndex: number, championId: string) => void;
  champions: Champion[];
  align: "left" | "right";
  label?: string;
  subLabel?: string;
  muted?: boolean;
}) {
  if (formIndex < 0) {
    return (
      <div className="relative grid h-24 place-items-center rounded-md border border-dashed border-border bg-background text-xs font-semibold text-muted">
        슬롯 없음
      </div>
    );
  }

  return (
    <ChampionPicker
      variant="tile"
      champions={champions}
      value={championId}
      disableHiddenInput
      onValueChange={(nextValue) => onChampionChange(formIndex, nextValue)}
      align={align}
      label={label}
      subLabel={subLabel}
      muted={muted}
    />
  );
}

function AdminDraftGrid({
  sideKey,
  side,
  mode,
  reverse = false,
  slots,
  championIds,
  onChampionChange,
  champions,
}: {
  sideKey: "blue" | "red";
  side: DraftSide;
  mode: "line" | "order";
  reverse?: boolean;
  slots: DraftSlot[];
  championIds: string[];
  onChampionChange: (formIndex: number, championId: string) => void;
  champions: Champion[];
}) {
  const orderedBans = [...side.bans].sort((a, b) => a.orderIndex - b.orderIndex);
  const orderedPicks = [...side.picks].sort((a, b) => a.orderIndex - b.orderIndex);
  const displayBans = reverse ? [...orderedBans].reverse() : orderedBans;
  const displayOrderedBans = reverse ? [...orderedBans].reverse() : orderedBans;
  const displayOrderedPicks = reverse ? [...orderedPicks].reverse() : orderedPicks;
  const lineEntries = side.lineup.map((line, index) => ({
    line,
    item: side.linePicks[index],
    positionIndex: index,
  }));
  const displayLineEntries = reverse ? [...lineEntries].reverse() : lineEntries;
  const align = reverse ? "right" : "left";

  const pickFormIndex = (slotNumber: number) => draftSlotFormIndex(slots, sideKey, "pick", slotNumber);
  const banFormIndex = (slotNumber: number) => draftSlotFormIndex(slots, sideKey, "ban", slotNumber);

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
              const slotNumber = banPickSlotNumber(orderedBans, item, index);
              const formIndex = banFormIndex(slotNumber);
              return (
                <DraftSlotPicker
                  key={`${sideKey}-ban-order-${index}`}
                  formIndex={formIndex}
                  championId={championIds[formIndex] ?? ""}
                  onChampionChange={onChampionChange}
                  champions={champions}
                  align={align}
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
              const slotNumber = orderPickSlotNumber(orderedPicks, item, index);
              const formIndex = pickFormIndex(slotNumber);
              return (
                <DraftSlotPicker
                  key={`${sideKey}-pick-order-${index}`}
                  formIndex={formIndex}
                  championId={championIds[formIndex] ?? ""}
                  onChampionChange={onChampionChange}
                  champions={champions}
                  align={align}
                  label={item ? `${orderNumber(item, orderedPicks)}번 픽` : `${index + 1}번 픽`}
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
            const item = displayBans[index] ?? null;
            const slotNumber = banPickSlotNumber(orderedBans, item, index);
            const formIndex = banFormIndex(slotNumber);
            const banNumber = item ? orderedBans.findIndex((b) => b.id === item.id) + 1 : null;
            return (
              <DraftSlotPicker
                key={`${sideKey}-ban-${index}`}
                formIndex={formIndex}
                championId={championIds[formIndex] ?? ""}
                onChampionChange={onChampionChange}
                champions={champions}
                align={align}
                muted
                label={banNumber ? `ban${banNumber}` : `${index + 1}번 밴`}
              />
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span>{side.teamName} 라인별 픽</span>
          <span className="text-muted">PICK</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {displayLineEntries.map(({ line, positionIndex }) => {
            const linePick = side.linePicks[positionIndex] ?? null;
            const matchedFormIndex = linePickFormIndex(slots, sideKey, orderedPicks, linePick);
            // stat line 매칭이 없으면 포지션 순서(TOP=1,JGL=2...) 슬롯으로 폴백
            const formIndex =
              matchedFormIndex >= 0
                ? matchedFormIndex
                : draftSlotFormIndex(slots, sideKey, "pick", positionIndex + 1);
            const championId = lineDisplayChampionId(linePick, formIndex, championIds);

            return (
              <DraftSlotPicker
                key={`${sideKey}-pick-${line.position}`}
                formIndex={formIndex}
                championId={championId}
                onChampionChange={onChampionChange}
                champions={champions}
                align={align}
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

export function AdminDraftEditor({
  set,
  champions,
  picksBans,
  blue,
  red,
}: {
  set: SetResult;
  champions: Champion[];
  picksBans: SetPickBan[];
  blue: DraftSide;
  red: DraftSide;
}) {
  const [mode, setMode] = useState<"line" | "order">("line");
  const slots = useMemo(() => buildDraftSlots({ set, picksBans }), [set, picksBans]);
  const [championIds, setChampionIds] = useState<string[]>([]);

  useEffect(() => {
    setChampionIds(slots.map((slot) => slot.championId));
  }, [slots]);

  function updateChampion(formIndex: number, championId: string) {
    setChampionIds((previous) => previous.map((value, index) => (index === formIndex ? championId : value)));
  }

  return (
    <section className="grid gap-4 rounded-md border border-border bg-surface p-4" aria-labelledby="draft-edit">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="draft-edit" className="text-xl font-semibold">
          밴픽
        </h2>
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

      <input type="hidden" name="pickBanCount" value={slots.length} />
      {slots.map((slot, index) => (
        <div key={`${slot.side}-${slot.actionType}-${slot.slotNumber}`} className="hidden">
          <input type="hidden" name={`pickBan.${index}.side`} value={slot.side} />
          <input type="hidden" name={`pickBan.${index}.actionType`} value={slot.actionType} />
          <input type="hidden" name={`pickBan.${index}.orderIndex`} value={slot.draftOrderIndex} />
          <input type="hidden" name={`pickBan.${index}.phase`} value={slot.phase} />
          <input type="hidden" name={`pickBan.${index}.teamId`} value={slot.teamId} />
          <input type="hidden" name={`pickBan.${index}.championId`} value={championIds[index] ?? ""} />
        </div>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminDraftGrid
          sideKey="blue"
          side={blue}
          mode={mode}
          reverse
          slots={slots}
          championIds={championIds}
          onChampionChange={updateChampion}
          champions={champions}
        />
        <AdminDraftGrid
          sideKey="red"
          side={red}
          mode={mode}
          slots={slots}
          championIds={championIds}
          onChampionChange={updateChampion}
          champions={champions}
        />
      </div>
    </section>
  );
}
