import Link from "next/link";

export function AdminPagination({
  pathname, page, totalPages, totalCount, filters = {}, pageKey = "page",
}: {
  pathname: string;
  page: number;
  totalPages: number;
  totalCount: number;
  filters?: Record<string, string>;
  pageKey?: string;
}) {
  function href(target: number) {
    const params = new URLSearchParams(filters);
    params.delete(pageKey);
    if (target > 1) params.set(pageKey, String(target));
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }
  return (
    <nav aria-label="목록 페이지" className="flex items-center justify-center gap-4 text-sm font-medium">
      {page > 1 ? <Link href={href(page - 1)}>이전</Link> : null}
      <span className="text-muted">{page} / {totalPages} 페이지 (총 {totalCount.toLocaleString()}건)</span>
      {page < totalPages ? <Link href={href(page + 1)}>다음</Link> : null}
    </nav>
  );
}
