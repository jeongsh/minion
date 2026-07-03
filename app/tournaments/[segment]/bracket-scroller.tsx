"use client";

import { useRef } from "react";

function SlideArrow({ direction }: { direction: "left" | "right" }) {
  const d = direction === "left" ? "M12.5 15L7.5 10L12.5 5" : "M7.5 5L12.5 10L7.5 15";

  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BracketScroller({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function slide(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.8 * direction, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="이전 라운드"
        onClick={() => slide(-1)}
        className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#0a0e1a] p-2 text-white shadow-lg transition-colors hover:bg-white/10 md:flex"
      >
        <SlideArrow direction="left" />
      </button>

      <div
        ref={scrollRef}
        className="scrollbar-none flex snap-x snap-proximity items-stretch gap-4 overflow-x-auto scroll-smooth pb-2"
      >
        {children}
      </div>

      <button
        type="button"
        aria-label="다음 라운드"
        onClick={() => slide(1)}
        className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#0a0e1a] p-2 text-white shadow-lg transition-colors hover:bg-white/10 md:flex"
      >
        <SlideArrow direction="right" />
      </button>
    </div>
  );
}
