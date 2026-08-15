"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TeamFields } from "./team-fields";
import { createTeamAction } from "./actions";

export function TeamCreateModal() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
      >
        + 팀 추가
      </Button>

      <dialog
        ref={dialogRef}
        className="modal-native fixed inset-0 m-auto w-[min(100%,42rem)] max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-surface p-0 shadow-xl backdrop:bg-black/50"
        onClose={handleClose}
      >
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">새 팀 추가</h3>
              <p className="mt-1 text-sm text-muted">고정 팬사이트 호스트와 기본 표시값을 입력합니다.</p>
            </div>
            <Button
              type="button"
              onClick={handleClose}
              variant="secondary"
            >
              닫기
            </Button>
          </div>

          <form
            action={async (formData) => {
              await createTeamAction(formData);
              handleClose();
            }}
            className="flex flex-col gap-6"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TeamFields />
            </div>
              <Button
                type="submit"
                className="self-end"
              >
              팀 생성
              </Button>
          </form>
        </div>
      </dialog>
    </>
  );
}
