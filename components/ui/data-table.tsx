import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import Link from "next/link";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";

export type DataTableColumn<T> = {
  key: string;
  label: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  headerClassName?: string;
  cellClassName?: string;
};

const alignClasses = { left: "text-left", center: "text-center", right: "text-right" };

export function DataTable<T>({
  columns,
  rows,
  emptyText = "표시할 데이터가 없습니다.",
  getRowHref,
  compact = false,
  mobileSurface = "card",
  className = "",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyText?: string;
  /** 지정하면 각 행 전체가 이 링크로 클릭 가능해진다(행 안 다른 링크/버튼과 겹치지 않는 표에서만 사용). */
  getRowHref?: (row: T) => string | undefined;
  /** 컬럼이 적고 좁은 컨테이너에서는 내용 기준 최소 너비를 강제하지 않는다. */
  compact?: boolean;
  /** 이전 호출부 호환용. 행 높이와 패딩은 Table에서 공통으로 정한다. */
  dense?: boolean;
  /** 이전 호출부 호환용. 표 스타일은 하나로 유지한다. */
  variant?: "default" | "hub";
  /** Continuous mobile data lists can drop the outer shell while desktop tables keep their card. */
  mobileSurface?: "card" | "flat";
  /** 이전 호출부 호환용. 모바일도 같은 표를 사용한다. */
  mobileDense?: boolean;
  className?: string;
}) {
  const mobileFlat = mobileSurface === "flat";
  if (rows.length === 0) {
    return (
      <KitschEmptyState
        character="marker"
        title="아직 숫자가 안 잡혔어요"
        body={emptyText}
        compact
        className={`${className} ${mobileFlat ? "mobile-data-list" : ""} bg-[var(--ui-surface)] dark:bg-[var(--ui-card-bg)]`}
      />
    );
  }

  return (
    <div className={`${className} ${mobileFlat ? "mobile-data-list" : ""} overflow-hidden rounded-[var(--ui-card-radius)] bg-[var(--ui-surface)] dark:bg-[var(--ui-card-bg)]`}>
      <Table className={compact ? undefined : "min-w-max"}>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} scope="col" className={[column.align && alignClasses[column.align], column.headerClassName].filter(Boolean).join(" ")}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-[var(--ui-card-divider)]">
          {rows.map((row, index) => {
            const href = getRowHref?.(row);
            return (
              <TableRow key={index} className={`align-middle ${href ? "relative hover:bg-[var(--ui-card-hover)]" : ""}`}>
                {columns.map((column, columnIndex) => (
                  <TableCell key={column.key} className={[column.align && alignClasses[column.align], column.cellClassName].filter(Boolean).join(" ")}>
                    {href && columnIndex === 0 ? (
                      <Link href={href} className="absolute inset-0 z-10" aria-label="상세 보기">
                        <span className="sr-only">상세 보기</span>
                      </Link>
                    ) : null}
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
