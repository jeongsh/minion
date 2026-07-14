"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

export type FilterOption = { value: string; label: string };

export function Divider() {
  return (
    <span aria-hidden="true" className="hidden text-2xl text-[var(--ui-border)] sm:inline">
      ·
    </span>
  );
}

export function FilterDropdown({
  ariaLabel,
  options,
  selected,
  onSelect,
  variant = "list",
  disabled = false,
  triggerClassName = "",
}: {
  ariaLabel: string;
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
  variant?: "list" | "grid";
  disabled?: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const triggerLabel = options.find((option) => option.value === selected)?.label ?? "-";

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
    setOpen(false);
    if (disabled) return;
    onSelect(value);
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1.5 text-[15px] font-bold tracking-tight text-[var(--ui-ink)] disabled:cursor-wait disabled:opacity-60 sm:text-base ${triggerClassName}`}
      >
        {triggerLabel}
        <Chevron open={open} />
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={popupRef}
          role="listbox"
          aria-label={ariaLabel}
          style={popupStyle}
          className="z-[80] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1.5 shadow-lg"
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
                    aria-selected={isSelected}
                    onClick={() => choose(option.value)}
                    className={`rounded-lg px-2 py-2.5 text-sm font-bold transition ${
                      isSelected
                        ? "bg-[var(--ui-surface-muted)] text-[var(--ui-ink)]"
                        : "text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"
                    }`}
                  >
                    {option.label}
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
                  aria-selected={isSelected}
                  onClick={() => choose(option.value)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition ${
                    isSelected
                      ? "bg-[var(--ui-surface-muted)] text-[var(--ui-ink)]"
                      : "text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"
                  }`}
                >
                  <span>{option.label}</span>
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
