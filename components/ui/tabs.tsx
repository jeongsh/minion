import Link from "next/link";

export type TabItem = {
  key: string;
  label: string;
  href: string;
};

/**
 * 세그먼티드 컨트롤. 회색 트랙 위에서 활성 항목만 흰 알약으로 떠오르는 iOS식 토글로,
 * 언더라인 탭과 한 줄에 나란히 놓아도 1차 내비게이션(탭)과 시각적으로 구분된다.
 * LCK 스플릿처럼 "탭 안에서 다시 범위를 좁히는" 컨트롤에 쓴다.
 */
export function SegmentedControl({
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
      className={`inline-flex w-fit shrink-0 gap-0.5 rounded-[10px] bg-[var(--ui-surface-muted)] p-[3px] ${className}`}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex h-8 shrink-0 items-center whitespace-nowrap rounded-lg px-3.5 text-[13px] transition-colors ${
              // 다크모드에서는 surface가 트랙보다 어두워 "떠오른 알약"이 거꾸로 파인 것처럼
              // 보인다. 트랙보다 밝은 border 톤으로 바꿔 위계를 유지한다.
              isActive
                ? "border border-[var(--ui-border)] bg-[var(--ui-surface)] font-extrabold text-[var(--ui-ink)] dark:bg-[var(--ui-border)]"
                : "font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
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
  activeTone = "accent",
}: {
  items: TabItem[];
  activeKey: string;
  ariaLabel: string;
  className?: string;
  /** 스플릿 칩 등과 한 줄에 합쳐 쓸 때는 바깥 래퍼가 트랙 보더를 그리므로 끈다. */
  bordered?: boolean;
  /** 승패 상태색과 내비게이션 활성색을 분리해야 하는 화면에서는 ink를 쓴다. */
  activeTone?: "accent" | "ink";
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
                ? activeTone === "ink"
                  ? "border-[var(--ui-ink)] text-[var(--ui-ink)]"
                  : "border-[var(--accent)] text-[var(--ui-ink)]"
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
