export function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper?: string;
}) {
  return (
    <article className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
      <p className="text-sm font-semibold text-[var(--ui-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold leading-none tracking-tight text-[var(--ui-ink)]">{value}</p>
      {helper ? <p className="mt-1.5 text-xs text-[var(--ui-muted)]">{helper}</p> : null}
    </article>
  );
}
