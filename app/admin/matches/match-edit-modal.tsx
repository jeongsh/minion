"use client";

import { useEffect, useRef, useState } from "react";

import type { Match, Player, Stage, Team, Tournament } from "@/lib/types";

import { updateMatchAction } from "./actions";
import { MatchFields } from "./match-fields";

export function MatchEditModal({
  match,
  teams,
  tournaments,
  stages,
  players,
}: {
  match: Match;
  teams: Team[];
  tournaments: Tournament[];
  stages: Stage[];
  players: Player[];
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-muted"
        onClick={() => setOpen(true)}
      >
        수정
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto w-[min(100%,48rem)] max-h-[90vh] overflow-y-auto rounded-md border border-border bg-surface p-0 shadow-xl backdrop:bg-black/50"
        onClose={() => setOpen(false)}
      >
        <form action={updateMatchAction} className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">{match.id}</p>
              <h3 className="font-semibold">{match.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                닫기
              </button>
              <button
                type="submit"
                className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
              >
                수정 저장
              </button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <MatchFields
              match={match}
              teams={teams}
              tournaments={tournaments}
              stages={stages}
              players={players}
            />
          </div>
        </form>
      </dialog>
    </>
  );
}
