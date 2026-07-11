import Link from "next/link";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

export function DataTable<T>({
  columns,
  rows,
  emptyText = "표시할 데이터가 없습니다.",
  getRowHref,
  compact = false,
  variant = "default",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyText?: string;
  /** 지정하면 각 행 전체가 이 링크로 클릭 가능해진다(행 안 다른 링크/버튼과 겹치지 않는 표에서만 사용). */
  getRowHref?: (row: T) => string | undefined;
  /** 컬럼이 적고 좁은 컨테이너(예: 2단 그리드)에 놓일 때 42rem 최소 너비를 강제하지 않는다. */
  compact?: boolean;
  /** Hub/fan surfaces use the shared 16px card radius and UI tokens. */
  variant?: "default" | "hub";
}) {
  const hub = variant === "hub";
  if (rows.length === 0) {
    return (
      <div className={`${hub ? "rounded-2xl border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-muted)]" : "rounded-md border-border bg-surface text-muted"} border p-6 text-sm`}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto border ${hub ? "rounded-2xl border-[var(--ui-border)] bg-[var(--ui-surface)]" : "rounded-md border-border bg-surface"}`}>
      <table className={`w-full border-collapse text-left text-sm ${compact ? "" : "min-w-[42rem]"}`}>
        <thead className={hub ? "bg-[var(--ui-surface-muted)] text-[13px] text-[var(--ui-muted)]" : "bg-surface-muted text-[13px] uppercase text-muted"}>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`px-4 py-3 font-semibold ${column.headerClassName ?? ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={hub ? "divide-y divide-[var(--ui-border)]" : "divide-y divide-border"}>
          {rows.map((row, index) => {
            const href = getRowHref?.(row);
            return (
              <tr key={index} className={`align-middle ${href ? `relative ${hub ? "hover:bg-[var(--ui-surface-muted)]" : "hover:bg-surface-muted"}` : ""}`}>
                {columns.map((column, columnIndex) => (
                  <td key={column.key} className={`px-4 py-3 ${column.cellClassName ?? ""}`}>
                    {href && columnIndex === 0 ? (
                      <Link href={href} className="absolute inset-0 z-10" aria-label="상세 보기">
                        <span className="sr-only">상세 보기</span>
                      </Link>
                    ) : null}
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
