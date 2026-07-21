"use client";

import { Button } from "@/components/ui/button";
import { setPlayerDivisionAction } from "./actions";

export function DivisionToggleButton({ id, target }: { id: string; target: "first" | "challengers" }) {
  return (
    <form action={setPlayerDivisionAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="division" value={target} />
      <Button type="submit" variant="secondary" size="sm" className="whitespace-nowrap">
        {target === "first" ? "1군" : "2군"}
      </Button>
    </form>
  );
}
