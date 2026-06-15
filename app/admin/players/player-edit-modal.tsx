"use client";

import { useEffect, useRef, useState } from "react";
import type { Player, Team } from "@/lib/types";
import { updatePlayerAction } from "./actions";

export function PlayerEditModal({ player, teams }: { player: Player; teams: Team[] }) {
  const [open, setOpen] = useState(false);
  const [isStarter, setIsStarter] = useState(player.isStarter ?? false);
const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) setIsStarter(player.isStarter ?? false);
  }, [open, player.isStarter]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-border px-2 py-1 text-xs font-semibold hover:bg-surface-muted"
      >
        수정
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto w-[min(100%,28rem)] rounded-md border border-border bg-surface p-0 shadow-xl backdrop:bg-black/50"
        onClose={() => setOpen(false)}
      >
        <div className="p-5">
          {/* 헤더 */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="font-semibold">선수 수정</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
            >
              닫기
            </button>
          </div>

          {/* 수정 폼 */}
          <form
            action={async (fd) => {
              await updatePlayerAction(fd);
              setOpen(false);
            }}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="id" value={player.id} />
            <input type="hidden" name="position" value={player.position} />
            <input type="hidden" name="is_starter" value={isStarter ? "true" : "false"} />

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">선수명 (ID)</span>
              <input
                name="name"
                defaultValue={player.name}
                required
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">본명</span>
              <input
                name="real_name"
                defaultValue={player.realName ?? ""}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">팀</span>
              <select
                name="team_id"
                defaultValue={player.teamId ?? ""}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="">— 없음 —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
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
                <span className="text-xs text-muted">같은 포지션 기존 주전은 자동으로 서브 처리</span>
              )}
            </label>

            <button
              type="submit"
              className="mt-1 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              저장
            </button>
          </form>

        </div>
      </dialog>
    </>
  );
}
