"use client";

import { useState } from "react";
import { ControlledDialog, dialogBodyClassName, DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
import { Button } from "@/components/ui/button";
import { TeamFields } from "./team-fields";
import { createTeamAction } from "./actions";

export function TeamCreateModal() {
  const [open, setOpen] = useState(false);


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

      <ControlledDialog open={open} onClose={handleClose} ariaLabel={"새 팀 추가"} panelClassName="sm:max-w-[42rem]">
        <DialogSheetHeader onClose={handleClose} title={"새 팀 추가"} />
        <div className={dialogBodyClassName}>
          <p className="mb-4 text-sm text-muted">고정 팬사이트 호스트와 기본 표시값을 입력합니다.</p>
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
      </ControlledDialog>
    </>
  );
}
