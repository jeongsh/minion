import Link from "next/link";
import { Fragment } from "react";

export type Crumb = { label: string; href?: string };

/**
 * 서브페이지 상단 공용 브레드크럼 — 12px, 구분자 "/", 현재 페이지만 잉크색.
 * 모든 서브페이지가 타이틀 대신 이 컴포넌트로 시작한다.
 * `.subpage` 토큰이 없는 페이지에서도 동일하게 보이도록 색상 폴백을 포함한다.
 */
export function Breadcrumb({ items, className = "" }: { items: Crumb[]; className?: string }) {
  const visibleItems = items.length > 1 ? items.slice(0, -1) : items;

  return (
    <nav aria-label="위치" className={`flex flex-wrap items-center gap-1.5 text-sm ${className}`}>
      {visibleItems.map((item, index) => {
        const isLast = index === visibleItems.length - 1;
        return (
          <Fragment key={`${item.label}-${index}`}>
            {item.href ? (
              <Link
                href={item.href}
                className="text-[var(--ink-3,var(--ui-muted))] transition-colors hover:text-[var(--ink,var(--ui-ink))]"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-[var(--ink-3,var(--ui-muted))]">
                {item.label}
              </span>
            )}
            {!isLast ? (
              <span className="text-[var(--sub-muted-weak,var(--ui-border))]" aria-hidden>
                /
              </span>
            ) : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
