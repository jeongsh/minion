"use client";

import { useLayoutEffect, useRef, useState } from "react";

const MAX_REPEAT_COUNT = 40;

export function FanTicker({ items }: { items: string[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cycleRef = useRef<HTMLDivElement>(null);
  const [repeatCount, setRepeatCount] = useState(2);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const cycle = cycleRef.current;
    if (!viewport || !track || !cycle) return;

    const measure = () => {
      const cycleWidth = cycle.getBoundingClientRect().width;
      if (!cycleWidth) return;

      const nextRepeatCount = Math.min(
        MAX_REPEAT_COUNT,
        Math.max(2, Math.ceil((viewport.clientWidth + 160) / cycleWidth)),
      );
      setRepeatCount(nextRepeatCount);
      track.style.setProperty(
        "--fan-ticker-duration",
        `${Math.max(18, (cycleWidth * nextRepeatCount * 2) / 52)}s`,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(cycle);
    return () => observer.disconnect();
  }, [items]);

  return (
    <div ref={viewportRef} className="overflow-hidden bg-[var(--team-primary)] py-[9px] text-[var(--team-on-primary)]">
      <div ref={trackRef} className="fan-ticker-track text-[13px] font-extrabold tracking-[0.08em]">
        {[false, true].map((hidden) => (
          <div key={String(hidden)} className="fan-ticker-group" aria-hidden={hidden || undefined}>
            {Array.from({ length: repeatCount }, (_, repeatIndex) => (
              <div
                key={repeatIndex}
                ref={!hidden && repeatIndex === 0 ? cycleRef : undefined}
                className="fan-ticker-cycle"
                aria-hidden={repeatIndex > 0 || undefined}
              >
                {items.map((item, itemIndex) => (
                  <span key={itemIndex} className="px-5">
                    {item}
                    <span className="ml-10 opacity-45">&middot;</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
