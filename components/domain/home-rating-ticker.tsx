"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SectionHeading } from "@/components/ui/section-heading";
import type { HomeRatingReview } from "@/lib/data/home-rating-reviews";
import styles from "./home-rating-ticker.module.css";

export function HomeRatingTicker({ items }: { items: HomeRatingReview[] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const reviewRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (items.length < 2 || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(current => (current + 1) % items.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [items.length, hovered, focused, reducedMotion]);

  const item = items.length ? items[index % items.length] : undefined;
  useEffect(() => {
    if (!reducedMotion) reviewRef.current?.animate([
      { transform: "translateY(100%)", opacity: 0 },
      { transform: "translateY(0)", opacity: 1 },
    ], { duration: 400, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
  }, [item?.id, reducedMotion]);

  if (!item) return null;

  return (
    <section aria-label="최근 경기 한줄평" className={`mt-3 hidden md:block ${styles.ticker}`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <Link href={item.href} title={`${item.matchLabel} ${item.playerName}: ${item.review}`}
        className="block rounded-xl bg-[var(--ui-card-bg)] px-4 transition-colors hover:bg-[var(--ui-card-hover)] focus-visible:bg-[var(--ui-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-ink)]">
      <SectionHeading className="!mb-0 min-h-14 !gap-4"
        aside={<ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--ui-muted)]" />}
        titleAccessory={
          <div className="min-w-0 flex-1 overflow-hidden">
              <span ref={reviewRef} className="flex min-h-11 min-w-0 items-center gap-3 text-base font-normal">
                <span className="flex min-w-0 shrink-0 items-center gap-2 text-sm font-medium text-[var(--ui-muted)]">
                  <span className="shrink-0">{item.matchLabel}</span>
                  <span className="truncate rounded bg-[var(--ui-surface)] px-2 py-0.5 text-[var(--ui-ink)]">{item.playerName}</span>
                </span>
                <span className="min-w-0 truncate">{item.review}</span>
              </span>
          </div>
        }>
        최근 경기 한줄평
      </SectionHeading>
      </Link>
    </section>
  );
}
