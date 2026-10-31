import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
  cellClassNames = [],
  rowClassName,
}: {
  rows?: number;
  columns?: number;
  className?: string;
  cellClassNames?: string[];
  rowClassName?: string;
}) {
  return (
    <Table containerClassName={className} aria-hidden="true">
      <TableHeader><TableRow>
        {Array.from({ length: columns }, (_, column) => <TableHead key={column} className={cellClassNames[column]}><Skeleton className="h-4 w-12 max-w-full" /></TableHead>)}
      </TableRow></TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, row) => <TableRow key={row} className={rowClassName}>
          {Array.from({ length: columns }, (_, column) => <TableCell key={column} className={cellClassNames[column]}><Skeleton className="h-4 w-20 max-w-full" /></TableCell>)}
        </TableRow>)}
      </TableBody>
    </Table>
  );
}
