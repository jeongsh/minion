import Link from "next/link";

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
}: {
  items: SegmentNavItem[];
  activeKey: string;
  activeSeason: number;
}) {
  if (items.length <= 1) return null;

  return (
    <nav
      aria-label="대회 선택"
      className="tab-scroll -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <Link
            key={item.key}
            href={`/tournaments/${item.key}?year=${activeSeason}`}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-4 text-[14px] font-black transition-colors sm:min-h-12 sm:px-5 sm:text-[15px] ${
              isActive
                ? "border-[var(--ui-ink)] bg-[var(--ui-ink)] text-[var(--ui-surface)]"
                : "border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-[var(--ui-muted)] hover:bg-[var(--ui-surface)] hover:text-[var(--ui-ink)]"
            }`}
          >
            {item.logo ? <TournamentMark logo={item.logo} className="h-[18px] w-[26px]" /> : null}
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
