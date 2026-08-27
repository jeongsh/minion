"use client";

import { Eye, EyeOff } from "lucide-react";

import { useSpoilerFree } from "@/lib/spoiler-free/spoiler-free-context";

export function SpoilerToggleButton({ variant = "pill", className }: { variant?: "pill" | "fab"; className?: string }) {
  const { enabled, toggle } = useSpoilerFree();

  if (variant === "fab") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        aria-label={`스포방지 ${enabled ? "끄기" : "켜기"}`}
        className={
          className ??
          `grid h-12 w-12 place-items-center rounded-full border shadow-[0_12px_34px_rgba(15,23,42,0.18)] transition-colors ${
            enabled
              ? "border-[var(--ui-ink)] bg-[var(--ui-ink)] text-[var(--ui-surface)]"
              : "border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink)] hover:bg-[var(--ui-card-hover)]"
          }`
        }
      >
        {enabled ? <EyeOff size={20} strokeWidth={1.8} /> : <Eye size={20} strokeWidth={1.8} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--ui-text)] transition-colors hover:border-[var(--ui-ink)] hover:text-[var(--ui-ink)]"
      }
    >
      {enabled ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
      스포방지 {enabled ? "ON" : "OFF"}
    </button>
  );
}
