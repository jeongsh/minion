"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deletePlayerAction } from "./actions";

export function DeleteButton({ id }: { id: string }) {
  const [confirmState, setConfirmState] = useState({ id: "", active: false });
  const confirm = confirmState.id === id && confirmState.active;

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <form action={deletePlayerAction}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="danger" size="sm">
            확인
          </Button>
        </form>
        <Button
          type="button"
          onClick={() => setConfirmState({ id, active: false })}
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
      onClick={() => setConfirmState({ id, active: true })}
      variant="danger"
      size="sm"
    >
      삭제
    </Button>
  );
}
