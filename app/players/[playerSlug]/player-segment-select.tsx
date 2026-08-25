"use client";

export function PlayerSegmentSelect({
  activeSegment,
  options,
}: {
  activeSegment: string;
  options: Array<{ href: string; label: string; value: string }>;
}) {
  return (
    <label className="relative block md:hidden">
      <span className="sr-only">대회 구간</span>
      <select
        aria-label="대회 구간"
        className="h-11 w-full appearance-none rounded-xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)] pl-3 pr-10 text-sm font-bold text-[var(--ui-ink)] outline-none transition focus:border-[var(--tp)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tp)_20%,transparent)]"
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next) window.location.assign(next.href);
        }}
        value={activeSegment}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <svg aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ui-muted)]" fill="none" viewBox="0 0 24 24">
        <path d="m7 10 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    </label>
  );
}
