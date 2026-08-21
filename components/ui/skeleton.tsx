export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md bg-[var(--ui-surface-muted)] ${className}`}
    />
  );
}
