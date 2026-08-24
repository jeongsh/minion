import Link from "next/link";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";

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
  dense = false,
  variant = "default",
  mobileSurface = "card",
  mobileDense = false,
  className = "",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyText?: string;
  /** 지정하면 각 행 전체가 이 링크로 클릭 가능해진다(행 안 다른 링크/버튼과 겹치지 않는 표에서만 사용). */
  getRowHref?: (row: T) => string | undefined;
  /** 컬럼이 적고 좁은 컨테이너(예: 2단 그리드)에 놓일 때 42rem 최소 너비를 강제하지 않는다. */
  compact?: boolean;
  /** 행 높이를 조밀하게(세로 패딩 축소). 순위표처럼 행이 많은 표에 사용한다. */
  dense?: boolean;
  /** Hub/fan surfaces use the shared 16px card radius and UI tokens. */
  variant?: "default" | "hub";
  /** Continuous mobile data lists can drop the outer shell while desktop tables keep their card. */
  mobileSurface?: "card" | "flat";
  /** 모바일 행만 52px 중심의 조밀한 랭킹 리스트로 표시한다. */
  mobileDense?: boolean;
  className?: string;
}) {
  const hub = variant === "hub";
  const mobileFlat = mobileSurface === "flat";
  if (rows.length === 0) {
    return (
      <KitschEmptyState
        character="marker"
        title="아직 숫자가 안 잡혔어요"
        body={emptyText}
        compact
        className={`${className} ${mobileFlat ? "mobile-data-list" : ""} ${hub ? "bg-[var(--ui-surface)]" : "bg-surface"}`}
      />
    );
  }

  return (
    <div className={`${className} ${mobileFlat ? "mobile-data-list" : ""} overflow-hidden border ${hub ? "rounded-2xl border-[var(--ui-border)] bg-[var(--ui-surface)]" : "rounded-xl border-border bg-surface md:rounded-md"}`}>
      <div className={hub ? "divide-y divide-[var(--ui-border)] md:hidden" : "divide-y divide-border md:hidden"}>
        {rows.map((row, index) => {
          const href = getRowHref?.(row);
          const content = (
            <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center ${mobileDense ? "min-h-[52px] gap-x-3 px-3 py-2 text-[13px]" : "min-h-16 gap-x-4 px-4 py-3 text-sm sm:px-3.5"}`}>
              <div className="min-w-0 font-bold text-[var(--ui-ink)]">{columns[0]?.render(row)}</div>
              {/* 지표 칸은 그리드 트랙을 각자 차지하면 개수(1~2개)에 따라 트랙 수가 달라져
                  줄바꿈이 나므로, 한 트랙 안에서 flex로 나란히 둔다. */}
              <div className={`flex shrink-0 items-center ${mobileDense ? "gap-2.5" : "gap-3"}`}>
                {columns.slice(1, 3).map((column) => <div key={column.key} className={`flex items-center justify-end text-right ${mobileDense ? "gap-1" : "gap-1.5"}`}><span className={`${mobileDense ? "text-[10px]" : "text-[11px]"} font-medium text-[var(--ui-muted)]`}>{column.label}</span><span className="font-bold text-[var(--ui-text)]">{column.render(row)}</span></div>)}
              </div>
            </div>
          );
          return href ? <Link key={index} href={href} className={`block ${hub ? "active:bg-[var(--ui-surface-muted)]" : "active:bg-surface-muted"}`}>{content}</Link> : <div key={index}>{content}</div>;
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className={`w-full border-collapse text-left text-sm ${compact ? "" : "min-w-[42rem]"}`}>
        <thead className={hub ? "bg-[var(--ui-surface-muted)] text-[13px] text-[var(--ui-muted)]" : "bg-surface-muted text-[13px] uppercase text-muted"}>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`px-4 ${dense ? "py-2" : "py-3"} font-semibold ${column.headerClassName ?? ""}`}>
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
                  <td key={column.key} className={`px-4 ${dense ? "py-2" : "py-3"} ${column.cellClassName ?? ""}`}>
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
    </div>
  );
}
