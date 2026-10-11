import Link from "next/link";
import type { ReactNode } from "react";

type TeamDirectoryItemProps = {
  label: string;
  ariaLabel: string;
  active: boolean;
  icon: ReactNode;
} & ({ href: string; onSelect?: never } | { href?: never; onSelect: () => void });

export function TeamDirectoryItem({ label, ariaLabel, active, icon, href, onSelect }: TeamDirectoryItemProps) {
  const className = `flex h-9 shrink-0 items-center gap-1 rounded-[var(--ui-control-radius)] border px-2 text-[13px] font-medium transition-colors ${active
    ? "border-[var(--tp,var(--accent))] bg-[var(--ui-surface)] text-[var(--ui-ink)]"
    : "border-transparent bg-[var(--ui-surface-muted)] text-[var(--ui-text)] hover:border-[var(--ui-border)] hover:text-[var(--ui-ink)]"}`;
  const content = <>{icon}<span>{label}</span></>;
  return href ? <Link href={href} aria-label={ariaLabel} aria-current={active ? "page" : undefined} className={className}>{content}</Link>
    : <button type="button" aria-label={ariaLabel} aria-pressed={active} onClick={onSelect} className={className}>{content}</button>;
}
