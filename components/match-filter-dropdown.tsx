"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

export type FilterOption = { value: string; label: string; icon?: ReactNode; indicator?: ReactNode };

export function FilterDropdown({
  ariaLabel,
  controlSize = "default",
  appearance = "default",
  options,
  selected,
  onSelect,
  variant = "list",
  disabled = false,
  rootClassName = "",
  triggerIcon,
  triggerClassName = "",
  placeholder = "-",
}: {
  ariaLabel: string;
  controlSize?: "default" | "compact";
  appearance?: "default" | "plain";
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
  variant?: "list" | "grid";
  disabled?: boolean;
  rootClassName?: string;
  triggerIcon?: ReactNode;
  triggerClassName?: string;
  triggerTypography?: "default" | "ui";
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupId = useId();
  const initialFocus = useRef<"selected" | "last">("selected");
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({ position: "fixed" });

  useLayoutEffect(() => {
    if (!open) return;
    const items = popupRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not([disabled])');
    const selectedItem = popupRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]:not([disabled])');
    const target = initialFocus.current === "last" ? items?.[items.length - 1] : selectedItem ?? items?.[0];
    target?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectedOption = options.find((option) => option.value === selected);
  const triggerLabel = selectedOption?.label ?? placeholder;
  const selectedIcon = triggerIcon ?? selectedOption?.icon;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const width = variant === "grid" ? 224 : Math.max(176, rect.width);
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
      setPopupStyle({
        position: "fixed",
        left,
        top: rect.bottom + 8,
        width,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, variant]);

  function choose(value: string) {
    if (disabled) return;
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
    onSelect(value);
  }

  function onOptionKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
      return;
    }
    const items = Array.from(popupRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not([disabled])') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = variant === "grid" ? 3 : 1;
    const offsets: Record<string, number> = { ArrowDown: step, ArrowUp: -step, ArrowRight: 1, ArrowLeft: -1 };
    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key in offsets) next = Math.max(0, Math.min(items.length - 1, index + offsets[event.key]));
    else return;
    event.preventDefault();
    items[next]?.focus();
  }

  return (
    <div className={`relative shrink-0 ${rootClassName}`} ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-controls={open ? popupId : undefined}
        disabled={disabled}
        onClick={() => {
          initialFocus.current = "selected";
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          initialFocus.current = event.key === "ArrowUp" ? "last" : "selected";
          setOpen(true);
        }}
        className={`inline-flex items-center rounded-lg text-sm font-medium text-[var(--ui-ink)] outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60 ${appearance === "plain" ? "gap-1.5 px-1.5" : "justify-between gap-2 border border-[var(--ui-card-bg)] bg-[var(--ui-surface)] px-3"} ${controlSize === "compact" ? "min-h-9" : "min-h-10"} ${triggerClassName}`}
      >
        {selectedIcon ? <span aria-hidden="true" className="flex shrink-0 items-center">{selectedIcon}</span> : null}
        {triggerLabel}
        {selectedOption?.indicator}
        <Chevron open={open} />
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={popupRef}
          id={popupId}
          role="listbox"
          aria-label={ariaLabel}
          style={popupStyle}
          onKeyDown={onOptionKeyDown}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget) && !ref.current?.contains(event.relatedTarget)) setOpen(false);
          }}
          className="z-[1100] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1.5 shadow-lg"
        >
          {variant === "grid" ? (
            <div className="grid grid-cols-3 gap-1">
              {options.map((option) => {
                const isSelected = option.value === selected;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    role="option"
                    tabIndex={-1}
                    aria-selected={isSelected}
                    onClick={() => choose(option.value)}
                    className={`rounded-lg px-2 py-2.5 text-sm font-medium transition ${
                      isSelected
                        ? "bg-[var(--ui-surface-muted)] text-[var(--ui-ink)]"
                        : "text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {option.icon ? <span aria-hidden="true" className="flex shrink-0 items-center">{option.icon}</span> : null}
                      {option.label}
                      {option.indicator}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            options.map((option) => {
              const isSelected = option.value === selected;

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  onClick={() => choose(option.value)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                    isSelected
                      ? "bg-[var(--ui-surface-muted)] text-[var(--ui-ink)]"
                      : "text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {option.icon ? <span aria-hidden="true" className="flex shrink-0 items-center">{option.icon}</span> : null}
                    {option.label}
                    {option.indicator}
                  </span>
                  {isSelected ? <CheckIcon /> : null}
                </button>
              );
            })
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`size-5 text-[var(--ui-muted)] transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
