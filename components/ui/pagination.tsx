import Link from "next/link";

type PaginationProps = {
  page: number;
  totalPages: number;
  onChange?: (page: number) => void;
  getHref?: (page: number) => string;
  className?: string;
};

const sideClassName = "min-h-10 px-2 text-sm font-medium text-[var(--ui-muted)]";
const pageClassName = "grid min-h-10 min-w-10 place-items-center rounded-[var(--ui-control-radius)] px-2 text-sm font-semibold";

export function Pagination({
  page,
  totalPages,
  onChange,
  getHref,
  className = "",
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const start = Math.max(1, Math.min(safePage - 2, safeTotalPages - 4));
  const pages = Array.from({ length: Math.min(5, safeTotalPages) }, (_, index) => start + index);

  const sideControl = (label: string, targetPage: number, disabled: boolean) => {
    if (disabled) {
      return <span aria-disabled="true" className={`${sideClassName} flex items-center opacity-30`}>{label}</span>;
    }
    if (getHref) {
      return <Link href={getHref(targetPage)} className={`${sideClassName} flex items-center hover:text-[var(--ui-ink)]`}>{label}</Link>;
    }
    return (
      <button type="button" onClick={() => onChange?.(targetPage)} className={`${sideClassName} hover:text-[var(--ui-ink)]`}>
        {label}
      </button>
    );
  };

  return (
    <nav className={`flex items-center justify-center gap-1 ${className}`} aria-label="페이지 이동">
      {sideControl("이전", safePage - 1, safePage === 1)}
      {pages.map((number) => {
        const active = number === safePage;
        const controlClassName = `${pageClassName} ${active ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"}`;
        if (getHref) {
          return <Link key={number} href={getHref(number)} aria-current={active ? "page" : undefined} className={controlClassName}>{number}</Link>;
        }
        return <button key={number} type="button" onClick={() => onChange?.(number)} aria-current={active ? "page" : undefined} className={controlClassName}>{number}</button>;
      })}
      {sideControl("다음", safePage + 1, safePage === safeTotalPages)}
    </nav>
  );
}
