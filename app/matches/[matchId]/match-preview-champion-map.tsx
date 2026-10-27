"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CHAMPION_MAP_HEIGHT, CHAMPION_MAP_ROW_HEIGHT, placePreviewChampions } from "@/packages/contracts/src/preview-chart-layout";

type Item = { championId: string; name: string; imageUrl: string; picksA: number; picksB: number };
const META = "text-[13px] font-medium leading-5 text-[var(--ui-muted)]";

export function ChampionPriorityPlot({ names, colors, items }: { names: string[]; colors: string[]; items: Item[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const totals = items.map((item) => item.picksA + item.picksB);
  const min = Math.min(...totals), max = Math.max(...totals);
  return <div>
    <div ref={ref} className="relative" style={{ height: CHAMPION_MAP_HEIGHT }}>
      <span aria-hidden className="absolute inset-y-0 left-1/2 border-l border-dashed border-[var(--ui-border)]" />
      {placePreviewChampions(items, width).map((item, index) => {
        const share = item.picksB / (item.picksA + item.picksB);
        const shared = share >= 0.4 && share <= 0.6;
        const ring = share < 0.4 ? colors[0] : share > 0.6 ? colors[1] : "var(--ui-muted)";
        const size = max === min ? 44 : Math.round(28 + (Math.sqrt(item.picksA + item.picksB) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min)) * 32);
        return <div key={item.championId} data-pop className="absolute flex w-[72px] -translate-x-1/2 flex-col items-center gap-1"
          style={{ left: `${item.x}%`, top: item.lane * CHAMPION_MAP_ROW_HEIGHT, "--i": index } as CSSProperties}
          title={`${item.name} ${names[0]} ${item.picksA}회 ${names[1]} ${item.picksB}회`}>
          <span className="flex h-[60px] items-center justify-center">
            <span className={`block overflow-hidden rounded-full bg-[var(--ui-card-bg)] ${shared ? "outline-2 outline-dashed" : "ring-2"}`} style={{ width: size, height: size, "--tw-ring-color": ring, outlineColor: ring } as CSSProperties}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 기존 챔피언 타일 자산 */}
              <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            </span>
          </span>
          <span className="w-full truncate text-center text-[13px] font-medium leading-4 text-[var(--ui-ink)]">{item.name}</span>
        </div>;
      })}
    </div>
    <div className={`mt-2 grid grid-cols-3 ${META}`}><span>{names[0]} 선호</span><span className="text-center">공통</span><span className="text-right">{names[1]} 선호</span></div>
  </div>;
}
