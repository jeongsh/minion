"use client";

import { useEffect, useRef, useState } from "react";

export type FilterOption = { value: string; label: string };

export function Divider() {
  return (
    <span aria-hidden="true" className="text-2xl text-border">
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
}: {
  ariaLabel: string;
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
  variant?: "list" | "grid";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
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

  function choose(value: string) {
    setOpen(false);
    if (disabled) return;
    onSelect(value);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 text-3xl font-black tracking-tight text-foreground disabled:cursor-wait disabled:opacity-60"
      >
        {triggerLabel}
        <Chevron open={open} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 top-full z-30 mt-2 rounded-xl border border-border bg-surface p-1.5 shadow-lg ${
            variant === "grid" ? "w-56" : "min-w-[11rem]"
          }`}
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
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:bg-surface-muted hover:text-foreground"
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
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected ? <CheckIcon /> : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`size-5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
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
