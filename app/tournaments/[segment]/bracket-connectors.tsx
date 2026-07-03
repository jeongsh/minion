"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

export type BracketConnection = {
  fromMatchId: string;
  toMatchId: string;
};

type Path = { id: string; d: string };

export function BracketConnectors({
  connections,
  accent,
  children,
}: {
  connections: BracketConnection[];
  accent: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<Path[]>([]);
  const markerId = `bracket-arrow-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const nextPaths: Path[] = [];

      for (const connection of connections) {
        const fromEl = container.querySelector<HTMLElement>(
          `[data-match-id="${connection.fromMatchId}"]`,
        );
        const toEl = container.querySelector<HTMLElement>(
          `[data-match-id="${connection.toMatchId}"]`,
        );
        if (!fromEl || !toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const x1 = fromRect.right - containerRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
        const x2 = toRect.left - containerRect.left;
        const y2 = toRect.top + toRect.height / 2 - containerRect.top;
        // 컬럼 간격이 좁으면서 세로 거리가 멀면 대각선처럼 뻗어버리는 것을 막기 위해,
        // 시작/끝에서 일정 거리는 수평으로 나갔다가 휘어지도록 고정 오프셋을 둔다.
        const offset = Math.max(40, Math.abs(x2 - x1) * 0.5);

        nextPaths.push({
          id: `${connection.fromMatchId}->${connection.toMatchId}`,
          d: `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`,
        });
      }

      setPaths(nextPaths);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [connections]);

  return (
    <div ref={containerRef} className="relative">
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={accent} fillOpacity={0.8} />
          </marker>
        </defs>
        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
            strokeOpacity={0.55}
            markerEnd={`url(#${markerId})`}
          />
        ))}
      </svg>
      {children}
    </div>
  );
}
