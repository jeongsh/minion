"use client";

import { useLayoutEffect, useRef, useState } from "react";

export type BracketConnection = {
  fromMatchId: string;
  toMatchId: string;
};

type Path = { id: string; d: string };

export function BracketConnectors({
  connections,
  children,
}: {
  connections: BracketConnection[];
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<Path[]>([]);

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
        const midX = (x1 + x2) / 2;

        nextPaths.push({
          id: `${connection.fromMatchId}->${connection.toMatchId}`,
          d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
        });
      }

      setPaths(nextPaths);

      // 결승(그랜드 파이널) 칸은 상위권/하위권 전체 라운드 수가 다르면 그리드 상
      // 전체 span의 정중앙이 실제로 연결되는 두 경기(상위권 결승, 하위권 결승)의
      // 중간 지점과 어긋날 수 있다. 실제로 이 경기로 연결되는 경기들의 평균 y
      // 위치에 맞춰 미세 조정한다.
      const finalsSlot = container.querySelector<HTMLElement>('[data-finals-slot="true"]');
      if (finalsSlot) {
        finalsSlot.style.transform = "";
        const finalsMatchEl = finalsSlot.querySelector<HTMLElement>("[data-match-id]");
        const finalsMatchId = finalsMatchEl?.dataset.matchId;

        if (finalsMatchId) {
          const sourceEls = connections
            .filter((connection) => connection.toMatchId === finalsMatchId)
            .map((connection) => container.querySelector<HTMLElement>(`[data-match-id="${connection.fromMatchId}"]`))
            .filter((el): el is HTMLElement => el !== null);

          if (sourceEls.length > 0) {
            const avgY =
              sourceEls.reduce((sum, el) => {
                const rect = el.getBoundingClientRect();
                return sum + (rect.top + rect.height / 2);
              }, 0) / sourceEls.length;

            const slotRect = finalsSlot.getBoundingClientRect();
            const slotCenterY = slotRect.top + slotRect.height / 2;
            const delta = avgY - slotCenterY;
            finalsSlot.style.transform = `translateY(${delta}px)`;
          }
        }
      }
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
        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            fill="none"
            stroke="rgba(17,24,39,0.28)"
            strokeWidth={2}
          />
        ))}
      </svg>
      {children}
    </div>
  );
}
