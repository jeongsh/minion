"use client";

import Link from "next/link";

import { useDragScroll } from "@/components/ui/use-drag-scroll";
import { type SegmentNavItem } from "@/lib/tournaments/segment-nav";

import { TournamentMark } from "./tournament-mark";

/**
 * 대회 스위처. 네이버 e스포츠의 리그 선택처럼 로고+이름 칩 레일로 처리한다. 언더라인 탭은
 * 콘텐츠 탭(순위/대진표)에만 쓰기 때문에, 여기서는 일정 페이지 필터와 같은 rounded-xl
 * 잉크 칩 언어를 쓴다.
 */
export function SegmentSwitcher({
  items,
  activeKey,
  activeSeason,
  className = "",
}: {
  items: SegmentNavItem[];
  activeKey: string;
  activeSeason: number;
  className?: string;
}) {
  const { scrollRef, dragHandlers } = useDragScroll<HTMLElement>();

  if (items.length <= 1) return null;

  return (
    // 스크롤바를 숨긴 레일이라 마우스 사용자에게는 스크롤 수단이 없다. 대진표와 같은
    // 드래그 스크롤을 붙여준다(터치는 기본 스와이프가 그대로 동작).
    <nav
      ref={scrollRef}
      {...dragHandlers}
      aria-label="대회 선택"
      className={`tab-scroll -ml-4 flex cursor-grab items-center gap-1.5 overflow-x-auto pl-4 active:cursor-grabbing active:select-none sm:ml-0 sm:gap-2 sm:pl-0 ${className}`}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <Link
            key={item.key}
            href={`/tournaments/${item.key}?year=${activeSeason}`}
            aria-current={isActive ? "page" : undefined}
            className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[13px] transition-colors sm:h-10 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-[14px] ${
              isActive
                ? "border-[var(--ui-ink)] bg-[var(--ui-ink)] font-extrabold text-[var(--ui-surface)]"
                : "border-[var(--ui-border)] bg-[var(--ui-surface)] font-bold text-[var(--ui-muted)] hover:border-[var(--ui-ink)] hover:text-[var(--ui-ink)]"
            }`}
          >
            {item.logo ? (
              <TournamentMark logo={item.logo} aspect={item.logoAspect} className="h-3.5 max-w-[30px] sm:h-4 sm:max-w-[34px]" />
            ) : null}
            <span>{item.name}</span>
            {item.isOngoing ? (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 motion-safe:animate-pulse"
                title="진행중"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
