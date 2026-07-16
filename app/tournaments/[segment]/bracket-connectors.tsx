"use client";

import { useLayoutEffect, useRef, useState } from "react";

export type BracketConnection = {
  fromMatchId: string;
  toMatchId: string;
  /** 이 경기에서 다음 경기로 진출하는 팀이 이 경기 카드에서 몇 번째 줄(0=위/1=아래)인지. 모르면(미완료 경기 등) 카드 중앙을 쓴다. */
  fromRow?: 0 | 1;
  /** 진출하는 팀이 다음 경기 카드에서 몇 번째 줄에 나오는지. 모르면 카드 중앙을 쓴다. */
  toRow?: 0 | 1;
};

type Path = { id: string; d: string };

function rowCenterY(
  container: HTMLElement,
  containerRect: DOMRect,
  matchId: string,
  row: 0 | 1 | undefined,
): number | null {
  const matchEl = container.querySelector<HTMLElement>(`[data-match-id="${matchId}"]`);
  if (!matchEl) return null;

  const rowEl = row !== undefined ? matchEl.querySelector<HTMLElement>(`[data-team-row="${row}"]`) : null;
  const rect = (rowEl ?? matchEl).getBoundingClientRect();
  return rect.top + rect.height / 2 - containerRect.top;
}

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

      const connectionsByTarget = new Map<string, BracketConnection[]>();
      for (const connection of connections) {
        const group = connectionsByTarget.get(connection.toMatchId) ?? [];
        group.push(connection);
        connectionsByTarget.set(connection.toMatchId, group);
      }

      for (const [toMatchId, group] of connectionsByTarget) {
        const toEl = container.querySelector<HTMLElement>(`[data-match-id="${toMatchId}"]`);
        if (!toEl) continue;
        const toRect = toEl.getBoundingClientRect();
        const x2 = toRect.left - containerRect.left;

        const rawSources = group
          .map((connection) => {
            const fromEl = container.querySelector<HTMLElement>(
              `[data-match-id="${connection.fromMatchId}"]`,
            );
            if (!fromEl) return null;
            const fromRect = fromEl.getBoundingClientRect();
            const y1 = rowCenterY(container, containerRect, connection.fromMatchId, connection.fromRow);
            if (y1 === null) return null;
            return { id: connection.fromMatchId, x1: fromRect.right - containerRect.left, y1, toRow: connection.toRow };
          })
          .filter(
            (source): source is { id: string; x1: number; y1: number; toRow: 0 | 1 | undefined } => source !== null,
          );

        if (rawSources.length === 0) continue;

        // 어느 쪽 슬롯(위/아래)으로 들어가는지는 경기 결과가 아니라 브래킷 구조로 정해진다
        // (예: 상위권 승자는 항상 위 슬롯, 하위권 승자는 항상 아래 슬롯). 소스가 2개면 아직
        // 결과가 안 나온 매치라도 위치는 이미 정해져 있으므로, 소스의 물리적 y 위치(위/아래)
        // 순서로 목적지 줄을 정한다.
        const sortedByY = rawSources.length > 1 ? [...rawSources].sort((a, b) => a.y1 - b.y1) : rawSources;

        // 연결마다 완전히 독립된 꺾은선(H-V-H)을 그린다 — 공유 세로선을 억지로 만들면 소스가
        // 서로 다른 칸(라운드)에 있을 때 먼 쪽 소스의 가로선이 중간 칸을 가로지르며 다른 카드와
        // 겹쳐 보일 수 있다. 대신 각자 자기 칸의 간격을 지나 독립적으로 그리면, 같은 칸에 있는
        // 소스끼리는 세로선 x가 우연히 같아져서 자연스럽게 하나로 합쳐진 것처럼 보인다.
        for (const [index, source] of sortedByY.entries()) {
          const toRow: 0 | 1 | undefined =
            sortedByY.length > 1 ? (index === 0 ? 0 : 1) : source.toRow;
          const y2 =
            rowCenterY(container, containerRect, toMatchId, toRow) ?? toRect.top + toRect.height / 2 - containerRect.top;
          const midX = (source.x1 + x2) / 2;
          nextPaths.push({
            id: `${source.id}->${toMatchId}`,
            d: `M ${source.x1} ${source.y1} H ${midX} V ${y2} H ${x2}`,
          });
        }
      }

      setPaths(nextPaths);

      // 카드 2개가 하나의 다음 경기로 합류하는 지점(승자조 결승끼리 만나는 결승, 상위권 라운드
      // 통합 등)은 그리드가 잡아준 자연스러운 위치가 실제로 연결되는 두 경기의 중간 지점과
      // 어긋날 수 있다. 정확히 두 경기 가운데(50:50)에 두면 오히려 아래로 처져 보이므로,
      // 승자조(물리적으로 더 위에 있는 소스) 카드 바로 아래 살짝 치우친 위치에 둔다.
      const UPPER_BIAS = 0.25;
      for (const [toMatchId, group] of connectionsByTarget) {
        const matchEl = container.querySelector<HTMLElement>(`[data-match-id="${toMatchId}"]`);
        if (!matchEl) continue;

        // 결승처럼 넓은 슬롯 안에서 가운데 정렬된 카드(data-merge-slot으로 감싸진 카드)만
        // 두 소스 사이 위치로 옮긴다. data-merge-slot이 없는 일반 그리드 카드(예: 그룹
        // 스테이지 "최종전"처럼 소스가 2개라도 자기 열의 정해진 행에 고정돼야 하는 카드)는
        // 여기서 옮기면 라벨과 어긋나 보이므로 건드리지 않는다.
        const slotEl = matchEl.closest<HTMLElement>("[data-merge-slot]");
        if (!slotEl) continue;
        slotEl.style.transform = "";

        if (group.length !== 2) continue;

        const sourceYs = group
          .map((connection) => {
            const fromEl = container.querySelector<HTMLElement>(`[data-match-id="${connection.fromMatchId}"]`);
            if (!fromEl) return null;
            const rect = fromEl.getBoundingClientRect();
            return rect.top + rect.height / 2;
          })
          .filter((y): y is number => y !== null);
        if (sourceYs.length !== 2) continue;

        // 이 칸 자체가 패자조(data-bracket-side="lower")로 분류돼 있으면, 두 소스 중
        // 위쪽(승자조) 소스 쪽으로 붙일 게 아니라 아래쪽(패자조) 소스 쪽에 붙여야 라벨이
        // 속한 패자조 구간 안에 자연스럽게 머문다.
        const bias = slotEl.dataset.bracketSide === "lower" ? 1 - UPPER_BIAS : UPPER_BIAS;
        const upperY = Math.min(...sourceYs);
        const lowerY = Math.max(...sourceYs);
        const targetY = upperY + (lowerY - upperY) * bias;
        // slotEl(래퍼) 기준으로 중심을 재면, 같은 grid 행을 공유하는 다른 열(예: 경기가
        // 2개 쌓여 더 큰 "1라운드" 열) 때문에 이 열의 래퍼도 늘어나 있을 수 있다. 늘어난
        // 래퍼 안에서 카드 자체는 위쪽에 붙어 있으므로, 래퍼가 아니라 카드의 실제 위치를
        // 기준으로 옮길 거리를 계산해야 한다.
        const cardRect = matchEl.getBoundingClientRect();
        const cardCenterY = cardRect.top + cardRect.height / 2;
        const delta = targetY - cardCenterY;
        slotEl.style.transform = `translateY(${delta}px)`;
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
    // 스크롤 컨테이너(flex)의 자식이라 기본적으로 내용 폭으로 줄어든다. 대진표가 컨테이너보다
    // 좁을 때 내부 그리드가 남는 폭을 채워(맨 오른쪽 노드를 우측 끝에 고정) "꽉 찬" 느낌을 주려면,
    // 이 래퍼가 최소한 컨테이너 폭만큼은 늘어나야 한다(넘칠 땐 w-max로 내용만큼 커져 스크롤).
    <div ref={containerRef} className="relative w-max min-w-full">
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            fill="none"
            stroke="var(--border)"
            strokeWidth={2}
          />
        ))}
      </svg>
      {children}
    </div>
  );
}
