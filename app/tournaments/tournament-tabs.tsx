import Link from "next/link";

export type TabItem = {
  key: string;
  label: string;
  href: string;
};

/**
 * 필터 칩 그룹. 일정 페이지 필터(FilterLink)와 같은 언어 — rounded-xl 사각 칩에 활성은
 * 잉크 채움. 같은 축의 값을 고르는 컨트롤(연도/스플릿/대진표 스테이지)에 쓴다.
 */
export function SegmentedNav({
  items,
  activeKey,
  ariaLabel,
  className = "",
}: {
  items: TabItem[];
  activeKey: string;
  ariaLabel: string;
  className?: string;
}) {
  if (items.length <= 1) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={`tab-scroll flex max-w-full items-center gap-2 overflow-x-auto ${className}`}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-11 min-w-16 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border px-4 text-[14px] font-black transition-colors sm:min-h-12 sm:min-w-20 sm:px-5 ${
              isActive
                ? "border-[var(--ui-ink)] bg-[var(--ui-ink)] text-[var(--ui-surface)]"
                : "border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-[var(--ui-ink)] hover:bg-[var(--ui-surface)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * 언더라인 탭. 팬 페이지 채널 내비와 같은 언어(파페로치 볼드 + 3px 언더라인)로, 화면의 주
 * 콘텐츠를 바꾸는 1차 내비게이션(순위/대진표/POM)에 쓴다.
 */
export function UnderlineNav({
  items,
  activeKey,
  ariaLabel,
  className = "",
  bordered = true,
}: {
  items: TabItem[];
  activeKey: string;
  ariaLabel: string;
  className?: string;
  /** 스플릿 칩 등과 한 줄에 합쳐 쓸 때는 바깥 래퍼가 트랙 보더를 그리므로 끈다. */
  bordered?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={`tab-scroll flex max-w-full items-center gap-5 overflow-x-auto sm:gap-7 ${
        bordered ? "border-b border-[var(--ui-border)]" : ""
      } ${className}`}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`font-paperozi flex shrink-0 items-center justify-center whitespace-nowrap border-b-[3px] py-2.5 text-[15px] font-bold transition-colors sm:py-3 sm:text-[16px] ${
              isActive
                ? "border-[var(--accent)] text-[var(--ui-ink)]"
                : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
