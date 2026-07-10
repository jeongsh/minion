"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { retirePlayerAction } from "./actions";

export function RetireButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setConfirm(false);
  }, [id]);

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <form action={retirePlayerAction}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="danger" size="sm">
            확인
          </Button>
        </form>
        <Button
          type="button"
          onClick={() => setConfirm(false)}
          variant="secondary"
          size="sm"
        >
          취소
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      onClick={() => setConfirm(true)}
      variant="danger"
      size="sm"
    >
      은퇴
    </Button>
  );
}
