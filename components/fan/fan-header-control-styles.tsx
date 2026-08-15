export const fanHeaderIconButtonClass =
  "group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[color-mix(in_srgb,var(--ui-ink)_78%,transparent)] transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--ui-ink)_38%,var(--ui-border))] hover:bg-[var(--ui-surface)] hover:text-[var(--ui-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-ink)] active:border-[var(--ui-ink)] active:bg-[var(--ui-surface)] disabled:opacity-60 sm:h-10 sm:w-10";

export const fanHeaderCountButtonClass =
  "group relative inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[12px] font-medium tabular-nums text-[color-mix(in_srgb,var(--ui-ink)_78%,transparent)] transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--ui-ink)_38%,var(--ui-border))] hover:bg-[var(--ui-surface)] hover:text-[var(--ui-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-ink)] active:border-[var(--ui-ink)] active:bg-[var(--ui-surface)] disabled:opacity-60 sm:h-10 sm:px-3.5 sm:text-[13px]";

export function FanHeaderTooltip({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  const position =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute bottom-full z-50 mb-2 whitespace-nowrap rounded-md bg-[var(--ui-ink)] px-2 py-1 text-[11px] font-medium leading-none text-[var(--ui-surface)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${position}`}
    >
      {children}
    </span>
  );
}
