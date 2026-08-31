"use client";

import Link from "next/link";
import { Check, Grid2X2, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { MiniconItem, MiniconPack } from "@/lib/minicons/types";

const RECENT_STORAGE_KEY = "minion:minicon-recents";
const RECENT_LIMIT = 48;

export function rememberMiniconUse(itemId: string) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]");
    const current = Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : [];
    window.localStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify([itemId, ...current.filter((value) => value !== itemId)].slice(0, RECENT_LIMIT)),
    );
  } catch {
    // 사생활 보호 모드처럼 localStorage가 막혀도 미니콘 전송은 계속 동작한다.
  }
}

export function MiniconPickerPanel({
  packs,
  selectedIds = [],
  onSelect,
  doubleMode = false,
  onDoubleModeChange,
  onStartDouble,
  mobile = false,
  placement = "comment",
  showDoubleMode = true,
}: {
  packs: MiniconPack[];
  selectedIds?: string[];
  onSelect: (item: MiniconItem) => void;
  doubleMode?: boolean;
  onDoubleModeChange?: (enabled: boolean) => void;
  onStartDouble?: (item: MiniconItem) => void;
  mobile?: boolean;
  placement?: "comment" | "editor";
  showDoubleMode?: boolean;
}) {
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState(packs[0]?.id ?? "recent");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const allItems = useMemo(() => packs.flatMap((pack) => pack.items), [packs]);

  useEffect(() => {
    let available: string[] = [];
    try {
      const stored = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]");
      const ids = Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : [];
      available = ids.filter((id) => allItems.some((item) => item.id === id)).slice(0, RECENT_LIMIT);
    } catch {
      available = [];
    }
    const frame = window.requestAnimationFrame(() => {
      setRecentIds(available);
      if (available.length > 0) setActiveTab("recent");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [allItems]);

  const recentItems = recentIds.flatMap((id) => {
    const item = allItems.find((candidate) => candidate.id === id);
    return item ? [item] : [];
  });
  const activePack = packs.find((pack) => pack.id === activeTab) ?? packs[0];
  const visibleItems = activeTab === "recent" ? recentItems : activePack?.items ?? [];

  const clearLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  return (
    <div
      className={`${placement === "editor" ? "fixed inset-x-2 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-[calc(100%+0.5rem)]" : mobile ? "fixed inset-x-2 bottom-[calc(4rem+env(safe-area-inset-bottom))]" : "absolute bottom-11 left-0"} z-30 flex max-h-[min(62vh,430px)] w-auto flex-col overflow-hidden rounded-[18px] border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-xl md:w-[372px]`}
      role="dialog"
      aria-label="미니콘 선택"
    >
      <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-2 py-1.5">
        {showDoubleMode ? (
          <button
            type="button"
            onClick={() => onDoubleModeChange?.(!doubleMode)}
            className="flex h-8 items-center gap-1.5 px-1.5 text-[13px] font-medium text-[var(--ui-text)]"
            aria-pressed={doubleMode}
          >
            <span className={`grid h-4 w-4 place-items-center border ${doubleMode ? "border-[var(--tp)] bg-[var(--tp)] text-white" : "border-[var(--ui-border)]"}`} aria-hidden="true">
              {doubleMode ? <Check size={12} strokeWidth={2.5} /> : null}
            </span>
            더블콘
          </button>
        ) : <span />}
        <div className="flex items-center gap-0.5">
          <Link
            href="/minicons"
            className="grid h-8 w-8 place-items-center rounded-full text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"
            aria-label="전체 미니콘 보기"
            title="전체 미니콘"
          >
            <Grid2X2 size={18} strokeWidth={1.7} />
          </Link>
          <Link
            href="/me/minicons"
            className="grid h-8 w-8 place-items-center rounded-full text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"
            aria-label="내 미니콘 설정"
            title="내 미니콘 설정"
          >
            <Settings size={19} strokeWidth={1.7} />
          </Link>
        </div>
      </div>
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--ui-border)] px-2 py-2" role="tablist" aria-label="미니콘 패키지">
        {recentItems.length > 0 ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "recent"}
            onClick={() => setActiveTab("recent")}
            className={`h-8 shrink-0 rounded-full px-3 text-[13px] font-medium ${activeTab === "recent" ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]"}`}
          >
            최근
          </button>
        ) : null}
        {packs.map((pack) => (
          <button
            key={pack.id}
            type="button"
            role="tab"
            aria-selected={activeTab === pack.id}
            onClick={() => setActiveTab(pack.id)}
            className={`h-8 shrink-0 rounded-full px-3 text-[13px] font-medium ${activeTab === pack.id ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]"}`}
          >
            {pack.name}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {visibleItems.length > 0 ? (
          <div className="grid grid-cols-5 gap-1.5" role="tabpanel">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={(event) => {
                  if (!mobile || event.detail === 0) onSelect(item);
                }}
                onPointerDown={mobile ? () => {
                  clearLongPress();
                  longPressTriggered.current = false;
                  longPressTimer.current = setTimeout(() => {
                    longPressTriggered.current = true;
                    onStartDouble?.(item);
                  }, 500);
                } : undefined}
                onPointerUp={mobile ? () => {
                  clearLongPress();
                  if (!longPressTriggered.current) onSelect(item);
                } : undefined}
                onPointerCancel={mobile ? clearLongPress : undefined}
                onPointerLeave={mobile ? clearLongPress : undefined}
                className={`group relative aspect-square overflow-hidden bg-[var(--ui-surface-muted)] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--tp)] motion-reduce:transition-none ${selectedIds.includes(item.id) ? "ring-2 ring-inset ring-[var(--tp)]" : ""}`}
                aria-label={`${item.packName} ${item.name} 선택`}
                title={item.name}
              >
                {/* 미니콘 URL은 공개 버킷의 사용자 콘텐츠라 Next 이미지 호스트를 사전 열거할 수 없다. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-[14px] font-normal text-[var(--ui-muted)]">최근 사용한 미니콘이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
