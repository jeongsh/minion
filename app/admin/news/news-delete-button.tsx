"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteVideoAction, deletePostAction } from "./actions";

export function NewsDeleteButton({
  id,
  type,
}: {
  id: string;
  type: "video" | "post";
}) {
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setConfirm(false);
  }, [id]);

  const action = type === "video" ? deleteVideoAction : deletePostAction;

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <form action={action}>
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
      삭제
    </Button>
  );
}
