// 사용자 페이지 공통 상단 헤더 — 선택적 브레드크럼 + 한글 타이틀.
import { Breadcrumb, type Crumb } from "@/components/layout/breadcrumb";

export function PageHeader({
  title,
  action,
  breadcrumbs,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
}) {
  const resolvedBreadcrumbs = breadcrumbs?.length
    ? breadcrumbs
    : [{ label: "홈", href: "/" }, { label: title }];

  return (
    <header className={`flex flex-col gap-3 ${className}`}>
      <Breadcrumb items={resolvedBreadcrumbs} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="home-section-title text-[28px] text-[var(--ui-ink)]">{title}</h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
