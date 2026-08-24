"use client";

import Image from "next/image";
import { ChevronRight, X } from "lucide-react";
import { Fragment, useEffect } from "react";
import { createPortal } from "react-dom";

import { itemImageUrl } from "@/lib/items";
import type { ItemPurchase, ItemPurchaseGroup, SkillLevelUp } from "@/lib/player-build";
import type { RuneBuildGrid, RuneGridOption, RuneGridRow } from "@/lib/runes";

export type PlayerBuildDetail = {
  playerName: string;
  championImageUrl: string;
  championName: string;
  version: string;
  keystoneUrl: string;
  treeUrl: string;
  /** 트리 전체 그리드(선택 안 된 옵션 포함). 데이터가 없으면 null → 키스톤+보조트리 2개로 대체 표시. */
  runeGrid: RuneBuildGrid | null;
  skillOrder: SkillLevelUp[];
  itemPurchaseGroups: ItemPurchaseGroup[];
};

const KEYSTONE_ICON_SIZE = 52;
const MINOR_ICON_SIZE = 30;

function RuneGridIcon({ option, size, square = false }: { option: RuneGridOption; size: number; square?: boolean }) {
  return (
    <span
      className={`relative shrink-0 overflow-hidden bg-[#0d1117] ${square ? "rounded-md" : "rounded-full"} ${
        option.selected ? "ring-2 ring-accent" : "opacity-40 grayscale"
      }`}
      style={{ height: size, width: size }}
      title={option.name}
    >
      {option.url ? (
        <Image src={option.url} alt={option.name} fill sizes={`${size}px`} unoptimized className="object-contain" />
      ) : null}
    </span>
  );
}

function RuneGridRowLine({ row, size, square }: { row: RuneGridRow; size: number; square?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {row.map((option) => (
        <RuneGridIcon key={option.name} option={option} size={size} square={square} />
      ))}
    </div>
  );
}

/**
 * 세 열(주계열/보조계열/파편) 모두 같은 뼈대를 쓴다 — 키스톤 칸을 항상 같은 높이로 예약해
 * 두어야, 키스톤이 없는 보조계열·파편 열의 첫 룬 행이 주계열의 첫 룬 행과 같은 높이에서
 * 시작한다(실제 게임 룬 페이지처럼).
 */
function RuneColumn({
  label,
  keystone,
  rows,
  square = false,
}: {
  label: string;
  keystone?: RuneGridOption;
  rows: RuneGridRow[];
  square?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2.5">
      <div className="flex items-center justify-center" style={{ height: KEYSTONE_ICON_SIZE }}>
        {keystone ? <RuneGridIcon option={keystone} size={KEYSTONE_ICON_SIZE} /> : null}
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <RuneGridRowLine key={index} row={row} size={MINOR_ICON_SIZE} square={square} />
        ))}
      </div>
      <span className="text-[11px] font-medium text-muted">{label}</span>
    </div>
  );
}

function RuneBuildGridView({ grid }: { grid: RuneBuildGrid }) {
  const selectedKeystone = grid.primaryRows[0]?.find((option) => option.selected);

  return (
    <div className="flex items-start justify-center gap-3 rounded-lg bg-[var(--ui-card-bg)] p-3">
      <RuneColumn label={grid.primaryTreeName} keystone={selectedKeystone} rows={grid.primaryRows.slice(1)} />
      <span className="my-1 w-px self-stretch bg-[var(--ui-border)]" aria-hidden="true" />
      <RuneColumn label={grid.secondaryTreeName} rows={grid.secondaryRows} />
      <span className="my-1 w-px self-stretch bg-[var(--ui-border)]" aria-hidden="true" />
      <RuneColumn label="능력치 파편" rows={grid.shardRows} square />
    </div>
  );
}

function clockLabel(timestampMs: number) {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const SKILL_SLOT_LABEL: Record<SkillLevelUp["slot"], string> = { 1: "Q", 2: "W", 3: "E", 4: "R" };

const SKILL_SLOT_STYLE: Record<SkillLevelUp["slot"], string> = {
  1: "border-sky-500/60 bg-sky-500/15 text-sky-400",
  2: "border-amber-500/60 bg-amber-500/15 text-amber-400",
  3: "border-fuchsia-500/60 bg-fuchsia-500/15 text-fuchsia-400",
  4: "border-accent bg-accent/15 text-accent",
};

function SkillBadge({ level, slot }: { level: number; slot: SkillLevelUp["slot"] }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span
        className={`grid aspect-square w-full max-w-8 place-items-center rounded border text-[11px] font-bold ${SKILL_SLOT_STYLE[slot]}`}
      >
        {SKILL_SLOT_LABEL[slot]}
      </span>
      <span className="text-[10px] font-medium text-muted">{level}</span>
    </span>
  );
}

function ItemPurchaseSlot({ purchase, version, order }: { purchase: ItemPurchase; version: string; order: number }) {
  return (
    <span className="flex shrink-0 flex-col items-center gap-1">
      <span
        className={`relative h-10 w-10 overflow-hidden rounded border border-[var(--ui-border)] bg-[var(--ui-card-bg)] ${
          purchase.sold ? "opacity-40" : ""
        }`}
      >
        <Image src={itemImageUrl(purchase.itemId, version)} alt="" fill sizes="40px" className="object-cover" />
      </span>
      <span className="text-[11px] font-medium text-muted">{purchase.sold ? "판매" : order}</span>
    </span>
  );
}

export function PlayerBuildModal({
  detail,
  onClose,
}: {
  detail: PlayerBuildDetail | null;
  onClose: () => void;
}) {
  const open = detail != null;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const hasTimelineData = detail.skillOrder.length > 0 || detail.itemPurchaseGroups.length > 0;
  const groupsWithStartOrder = detail.itemPurchaseGroups.reduce<
    Array<{ group: ItemPurchaseGroup; startOrder: number; label: string }>
  >((acc, group, groupIndex) => {
    const previous = acc.at(-1);
    const startOrder = previous ? previous.startOrder + previous.group.purchases.length : 1;
    // 미니언이 등장하기 전(대략 65초)에 이뤄진 첫 구매 묶음은 귀환이 아니라 시작 구매다.
    const isStartingPurchase = groupIndex === 0 && group.purchases[0].timestampMs < 90_000;
    const recallNumber = acc.filter((entry) => entry.label.startsWith("귀환")).length + 1;
    const label = isStartingPurchase ? "시작 구매" : `귀환 ${recallNumber}`;
    return [...acc, { group, startOrder, label }];
  }, []);

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 [--modal-backdrop-dark-mobile:0.65] sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${detail.playerName} 빌드 상세`}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-[var(--ui-surface)] text-[var(--ui-ink)] shadow-2xl sm:max-w-xl sm:rounded-[24px]"
      >
        <div className="flex min-h-14 items-center gap-3 border-b border-[var(--ui-border)] px-4 sm:min-h-16 sm:px-5">
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[var(--ui-border)] bg-[var(--ui-card-bg)]">
            {detail.championImageUrl ? (
              <Image src={detail.championImageUrl} alt="" fill sizes="40px" className="object-cover" />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-bold leading-tight">{detail.playerName}</h2>
            <p className="truncate text-xs text-muted">{detail.championName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-[var(--ui-surface-muted)]"
            aria-label="닫기"
          >
            <X size={21} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <section className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">룬</h3>
            {detail.runeGrid ? (
              <RuneBuildGridView grid={detail.runeGrid} />
            ) : (
              <div className="flex items-center gap-2">
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#0d1117] border border-white/10">
                  {detail.keystoneUrl ? (
                    <Image src={detail.keystoneUrl} alt="" fill sizes="40px" unoptimized className="object-contain" />
                  ) : null}
                </span>
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#0d1117]">
                  {detail.treeUrl ? (
                    <Image src={detail.treeUrl} alt="" fill sizes="32px" unoptimized className="scale-[0.72] object-contain" />
                  ) : null}
                </span>
              </div>
            )}
          </section>

          {hasTimelineData ? (
            <>
              {detail.skillOrder.length > 0 ? (
                <section className="mb-5">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">스킬 빌드</h3>
                  <div className="flex gap-1">
                    {detail.skillOrder.map((skill) => (
                      <SkillBadge key={skill.level} level={skill.level} slot={skill.slot} />
                    ))}
                  </div>
                </section>
              ) : null}

              {groupsWithStartOrder.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">아이템 구매 순서</h3>
                  <div className="flex flex-wrap items-center gap-1">
                    {groupsWithStartOrder.map(({ group, startOrder, label }, groupIndex) => (
                      <Fragment key={`${group.purchases[0].itemId}-${group.purchases[0].timestampMs}`}>
                        <div
                          className="flex items-center gap-1.5"
                          title={`${label} · ${clockLabel(group.purchases[0].timestampMs)}`}
                        >
                          {group.purchases.map((purchase, index) => (
                            <ItemPurchaseSlot
                              key={`${purchase.itemId}-${purchase.timestampMs}`}
                              purchase={purchase}
                              version={detail.version}
                              order={startOrder + index}
                            />
                          ))}
                        </div>
                        {groupIndex < groupsWithStartOrder.length - 1 ? (
                          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
                        ) : null}
                      </Fragment>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <p className="rounded-lg bg-[var(--ui-card-bg)] p-3 text-sm text-muted">
              이 세트는 타임라인 데이터가 아직 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
