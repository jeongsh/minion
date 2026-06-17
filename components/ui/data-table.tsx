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
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyText?: string;
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
          {rows.map((row, index) => (
            <tr key={index} className="align-middle">
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-3 ${column.cellClassName ?? ""}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
