"use client";

import { useEffect, useState } from "react";
import { deletePlayerAction } from "./actions";

export function DeleteButton({ id, name }: { id: string; name: string }) {
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setConfirm(false);
  }, [id]);

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <form action={deletePlayerAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white">
            확인
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="rounded border border-border px-2 py-1 text-xs font-semibold"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="rounded border border-red-500/40 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10"
    >
      삭제
    </button>
  );
}
