import type { ComponentProps } from "react";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={
        "h-10 w-full min-w-0 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm font-normal text-[var(--ui-text)] outline-none transition placeholder:text-[var(--ui-muted)] focus:border-[var(--ui-ink)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ui-ink)_12%,transparent)] disabled:opacity-50 " +
        className
      }
      {...props}
    />
  );
}
