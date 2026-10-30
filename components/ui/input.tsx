import type { ComponentProps } from "react";

export const formControlClassName = "h-10 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] outline-none transition focus:border-[var(--ui-ink)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ui-ink)_12%,transparent)]";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={
        formControlClassName + " w-full min-w-0 px-3 text-sm font-normal text-[var(--ui-text)] placeholder:text-[var(--ui-muted)] disabled:opacity-50 " +
        className
      }
      {...props}
    />
  );
}
