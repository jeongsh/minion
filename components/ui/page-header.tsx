import { Breadcrumb, type Crumb } from "@/components/layout/breadcrumb";

function pageHeaderTitle(title: string) {
  if (!/[\uAC00-\uD7A3]/.test(title) || !/[A-Za-z]/.test(title)) return title;

  return title
    .replace(/[A-Za-z][A-Za-z0-9&'._:+#/-]*/g, "")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .replace(/(?:[|/:,-]|\u00B7)\s*$/g, "")
    .trim();
}

export function PageHeader({
  title,
  leading,
  action,
  breadcrumbs,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  /** 제목 왼쪽에 붙는 마크(대회 로고 등). */
  leading?: React.ReactNode;
  action?: React.ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
}) {
  const resolvedBreadcrumbs = breadcrumbs?.length
    ? breadcrumbs
    : [{ label: "홈", href: "/" }, { label: title }];
  const displayTitle = pageHeaderTitle(title);

  return (
    <header className={`flex min-w-0 flex-col gap-3 ${className}`}>
      <Breadcrumb items={resolvedBreadcrumbs} className="hidden md:flex" />
      <div className="flex min-w-0 items-center justify-between gap-3 md:items-end">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          {leading}
          <h1 className="home-section-title font-paperozi min-w-0 truncate text-[20px] leading-tight text-[var(--ui-ink)] md:text-[24px] lg:text-[28px]">
            {displayTitle || title}
          </h1>
        </div>
        {action ? <div className="flex min-h-10 shrink-0 items-center justify-end">{action}</div> : null}
      </div>
    </header>
  );
}
