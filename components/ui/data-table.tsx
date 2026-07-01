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
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyText?: string;
  /** 지정하면 각 행 전체가 이 링크로 클릭 가능해진다(행 안 다른 링크/버튼과 겹치지 않는 표에서만 사용). */
  getRowHref?: (row: T) => string | undefined;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`px-4 py-3 font-semibold ${column.headerClassName ?? ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => {
            const href = getRowHref?.(row);
            return (
              <tr key={index} className={`align-middle ${href ? "relative hover:bg-surface-muted" : ""}`}>
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
