import Link from "next/link";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export type DataTableColumn<T> = {
  key: string;
  label: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  headerClassName?: string;
  cellClassName?: string;
};

const alignClasses = { left: "text-left", center: "text-center", right: "text-right" };

/** 순위는 이름 셀에 섞지 않고 공용 표의 숫자 스타일과 정렬을 따른다. */
export function rankColumn<T extends { rank: number }>(): DataTableColumn<T> {
  return {
    key: "rank",
    label: "순위",
    align: "center",
    headerClassName: "w-14",
    render: (row) => row.rank,
  };
}

export function DataTable<T>({
  columns,
  rows,
  emptyText = "표시할 데이터가 없습니다.",
  getRowHref,
  compact = false,
  framed = true,
  className = "",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyText?: string;
  /** 지정하면 각 행 전체가 이 링크로 클릭 가능해진다(행 안 다른 링크/버튼과 겹치지 않는 표에서만 사용). */
  getRowHref?: (row: T) => string | undefined;
  /** 컬럼이 적고 좁은 컨테이너에서는 내용 기준 최소 너비를 강제하지 않는다. */
  compact?: boolean;
  /** 외곽선이 있는 상세 콘텐츠에 삽입할 때 false로 지정한다. */
  framed?: boolean;
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <KitschEmptyState
        character="marker"
        title="아직 숫자가 안 잡혔어요"
        body={emptyText}
        compact
        className={`${className} bg-[var(--ui-surface)]`}
      />
    );
  }

  return (
    <Table
      className={compact ? undefined : "min-w-max"}
      containerClassName={className}
      framed={framed}
    >
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} scope="col" className={[column.align && alignClasses[column.align], column.headerClassName].filter(Boolean).join(" ")}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const href = getRowHref?.(row);
          return (
            <TableRow key={index} className={href ? "relative" : undefined}>
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
  );
}
