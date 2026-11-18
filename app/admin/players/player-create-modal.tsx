"use client";

import { useState } from "react";
import { ControlledDialog, dialogBodyClassName, DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
import { Button } from "@/components/ui/button";
import type { Team } from "@/lib/types";
import { createPlayerAction } from "./actions";

const POSITIONS = ["TOP", "JGL", "MID", "BOT", "SUP"] as const;
const POS_LABEL: Record<string, string> = {
  TOP: "탑", JGL: "정글", MID: "미드", BOT: "원딜", SUP: "서폿",
};

export function PlayerCreateModal({ teams }: { teams: Team[] }) {
  const [open, setOpen] = useState(false);
  const [isStarter, setIsStarter] = useState(false);


  function handleClose() {
    setOpen(false);
    setIsStarter(false);
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
      >
        + 선수 추가
      </Button>

      <ControlledDialog open={open} onClose={handleClose} ariaLabel={"선수 추가"} panelClassName="sm:max-w-[28rem]">
        <DialogSheetHeader onClose={handleClose} title={"선수 추가"} />
        <div className={dialogBodyClassName}>
                    <form
            action={async (fd) => {
              await createPlayerAction(fd);
              handleClose();
            }}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="is_starter" value={isStarter ? "true" : "false"} />

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">선수명 (ID) <span className="text-red-500">*</span></span>
              <input
                name="name"
                required
                placeholder="예) Faker"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">본명</span>
              <input
                name="real_name"
                placeholder="예) Lee Sang-hyeok"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">포지션 <span className="text-red-500">*</span></span>
              <select
                name="position"
                required
                defaultValue=""
                className="minion-native-select rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="" disabled>— 선택 —</option>
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>{POS_LABEL[pos]} ({pos})</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">팀</span>
              <select
                name="team_id"
                defaultValue=""
                className="minion-native-select rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="">— 없음 —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <label className="flex cursor-pointer items-center gap-3">
              <div
                onClick={() => setIsStarter((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${isStarter ? "bg-accent" : "bg-border"}`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${isStarter ? "translate-x-6" : "translate-x-1"}`}
                />
              </div>
              <span className="text-sm font-medium">주전 선수</span>
              {isStarter && (
                <span className="text-[13px] text-muted">같은 포지션 기존 주전은 자동으로 서브 처리</span>
              )}
            </label>

              <Button
                type="submit"
                className="mt-1"
              >
              추가
              </Button>
          </form>
        </div>
      </ControlledDialog>
    </>
  );
}
