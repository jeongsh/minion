export function AdSlot({ className="" }: { className?: string }) {
  return <aside aria-label="광고 영역" className={`grid place-items-center rounded-[var(--ui-card-radius)] bg-[var(--ui-ad-surface)] text-xs font-bold tracking-[.18em] text-[#96999f] ${className}`}>ADVERTISEMENT</aside>;
}

