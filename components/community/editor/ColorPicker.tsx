"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PANEL_WIDTH = 172;
const VIEWPORT_GAP = 12;

const PRESET_COLORS = [
  // 회색 계열
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  // 선명한 원색
  "#ff0000", "#ff6d00", "#ffff00", "#00c853", "#00bcd4", "#2962ff", "#6200ea", "#c51162", "#ff4081", "#ff6e40",
  // 중간 계열
  "#e53935", "#fb8c00", "#fdd835", "#43a047", "#00acc1", "#1e88e5", "#8e24aa", "#e91e63", "#c62828", "#e65100",
  // 연한 계열
  "#ef9a9a", "#ffcc80", "#fff59d", "#a5d6a7", "#80deea", "#90caf9", "#ce93d8", "#f48fb1", "#ffab91", "#ffe082",
  // 매우 연한/파스텔
  "#ffcdd2", "#ffe0b2", "#fff9c4", "#dcedc8", "#b2ebf2", "#e3f2fd", "#e8eaf6", "#fce4ec", "#f8bbd0", "#fff3e0",
];

interface Props {
  value: string;
  onChange: (color: string) => void;
  onBeforeCustomPick: () => void;
  icon: React.ReactNode;
  quickSetLabel: string;
  quickSetValue: string;
}

export function ColorPicker({ value, onChange, onBeforeCustomPick, icon, quickSetLabel, quickSetValue }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // 툴바의 overflow 영역에 잘리지 않도록 패널을 body에 portal로 띄우고 트리거 기준으로 배치한다.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      if (!window.matchMedia("(min-width: 768px)").matches) {
        setPosition(null);
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 0;
      const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_GAP;
      const left = Math.max(VIEWPORT_GAP, Math.min(rect.left, maxLeft));
      const below = rect.bottom + 4;
      const top = panelHeight && below + panelHeight > window.innerHeight - VIEWPORT_GAP
        ? Math.max(VIEWPORT_GAP, rect.top - 4 - panelHeight)
        : below;
      setPosition({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [open]);

  const applyPreset = (color: string, e: React.MouseEvent) => {
    e.preventDefault();
    onChange(color);
    setOpen(false);
  };

  const safeColor = value && value.startsWith("#") ? value : "#000000";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((prev) => !prev);
        }}
        className="flex flex-col items-center gap-0.5 rounded p-1.5 hover:bg-surface-muted"
        title="색상 선택"
      >
        {icon}
        <span
          className="block h-[3px] w-3.5 border border-border"
          style={{
            backgroundColor: value === "transparent" || !value ? "transparent" : value,
          }}
        />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          className={`fixed z-[70] rounded-xl border border-border bg-surface p-2 md:rounded-md ${position ? "" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"}`}
          style={{ width: PANEL_WIDTH, maxWidth: "calc(100vw - 24px)", ...(position ?? {}) }}
        >
          {/* 빠른 초기화 */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(quickSetValue);
              setOpen(false);
            }}
            className="mb-1.5 w-full rounded border border-border py-0.5 text-[13px] text-muted hover:bg-surface-muted"
          >
            {quickSetLabel}
          </button>

          {/* 색상 그리드 */}
          <div className="grid grid-cols-10 gap-px">
            {PRESET_COLORS.map((color, i) => (
              <button
                key={i}
                type="button"
                title={color}
                onMouseDown={(e) => applyPreset(color, e)}
                className="h-3.5 w-3.5 transition-transform hover:scale-125 hover:ring-1 hover:ring-foreground/60"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* 직접 선택 */}
          <div className="mt-1.5 border-t border-border pt-1.5">
            <button
              type="button"
              className="w-full rounded border border-border py-0.5 text-[13px] text-muted hover:bg-surface-muted"
              onMouseDown={() => onBeforeCustomPick()}
              onClick={() => {
                setOpen(false);
                customInputRef.current?.click();
              }}
            >
              다른 색상 선택
            </button>
            <input
              ref={customInputRef}
              type="color"
              className="sr-only"
              value={safeColor}
              onChange={(e) => onChange(e.target.value)}
              onInput={(e) => onChange((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
