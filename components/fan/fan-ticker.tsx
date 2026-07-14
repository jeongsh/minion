"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function FanTicker({ items }: { items: string[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const [repeatCount, setRepeatCount] = useState(2);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const group = groupRef.current;
    if (!viewport || !track || !group) return;

    const measure = () => {
      const cycleWidth = group.scrollWidth / repeatCount;
      if (!cycleWidth) return;

      const nextRepeatCount = Math.max(2, Math.ceil((viewport.clientWidth + 160) / cycleWidth));
      if (nextRepeatCount !== repeatCount) {
        setRepeatCount(nextRepeatCount);
        return;
      }

      track.style.setProperty("--fan-ticker-duration", `${Math.max(18, group.scrollWidth / 52)}s`);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(group);
    return () => observer.disconnect();
  }, [items, repeatCount]);

  return (
    <div ref={viewportRef} className="overflow-hidden bg-[var(--team-primary)] py-[9px] text-[var(--team-on-primary)]">
      <div ref={trackRef} className="fan-ticker-track text-[13px] font-extrabold tracking-[0.08em]">
        {[false, true].map((hidden) => (
          <div
            key={String(hidden)}
            ref={hidden ? undefined : groupRef}
            className="fan-ticker-group"
            aria-hidden={hidden || undefined}
          >
            {Array.from({ length: repeatCount }, (_, repeatIndex) =>
              items.map((item, itemIndex) => (
                <span
                  key={`${repeatIndex}-${itemIndex}`}
                  className="px-5"
                  aria-hidden={repeatIndex > 0 || undefined}
                >
                  {item}
                  <span className="ml-10 opacity-45">&middot;</span>
                </span>
              )),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
