"use client";

import { useDragScroll } from "@/components/ui/use-drag-scroll";

function SlideArrow({ direction }: { direction: "left" | "right" }) {
  const d = direction === "left" ? "M12.5 15L7.5 10L12.5 5" : "M7.5 5L12.5 10L7.5 15";

  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BracketScroller({ children }: { children: React.ReactNode }) {
  const { scrollRef, canScrollLeft, canScrollRight, slide, dragHandlers } = useDragScroll<HTMLDivElement>();

  return (
    <div className="relative">
      {canScrollLeft ? (
        <button
          type="button"
          aria-label="이전 라운드"
          onClick={() => slide(-1)}
          className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface p-2 text-foreground shadow-md transition-colors hover:bg-surface-muted md:flex"
        >
          <SlideArrow direction="left" />
        </button>
      ) : null}

      <div
        ref={scrollRef}
        {...dragHandlers}
        className="scrollbar-none flex cursor-grab snap-x snap-proximity items-stretch gap-4 overflow-x-auto scroll-smooth pb-2 active:cursor-grabbing active:select-none"
      >
        {children}
      </div>

      {canScrollRight ? (
        <button
          type="button"
          aria-label="다음 라운드"
          onClick={() => slide(1)}
          className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface p-2 text-foreground shadow-md transition-colors hover:bg-surface-muted md:flex"
        >
          <SlideArrow direction="right" />
        </button>
      ) : null}
    </div>
  );
}
