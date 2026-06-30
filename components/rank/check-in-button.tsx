"use client";

import { useActionState } from "react";

import { checkInAction } from "@/lib/auth/actions";
import { INITIAL_ATTENDANCE_STATE } from "@/lib/auth/action-state";

export function CheckInButton({ alreadyChecked }: { alreadyChecked: boolean }) {
  const [state, formAction, pending] = useActionState(
    checkInAction,
    INITIAL_ATTENDANCE_STATE,
  );

  const done = alreadyChecked || state.status === "success" || state.status === "already";

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending || done}
        className="rounded-md px-4 py-2 text-sm font-bold text-[var(--accent-foreground)] disabled:opacity-60"
        style={{ backgroundColor: "var(--accent)" }}
      >
        {done ? "오늘 출석 완료" : pending ? "처리 중…" : "출석체크 (+10 LP)"}
      </button>
      {state.message ? (
        <p
          role="status"
          className="text-sm"
          style={{
            color: state.status === "error" ? "#dc2626" : "var(--muted)",
          }}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
