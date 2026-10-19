"use client";

import { useId, useState, type ReactNode } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export function ExpandableTableRow({
  cells,
  children,
  label,
}: {
  cells: ReactNode[];
  children: ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <TableRow>
        {cells.map((cell, index) => (
          <TableCell key={index}>{cell}</TableCell>
        ))}
        <TableCell>
          <Button
            variant="secondary"
            size="sm"
            aria-label={label}
            aria-expanded={open}
            aria-controls={open ? id : undefined}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "접기" : "상세"}
          </Button>
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCell colSpan={cells.length + 1}>
            <div id={id}>{children}</div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
