import type { HTMLAttributes } from "react";

export function SurfacePanel({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] ${className}`}
      {...props}
    />
  );
}
