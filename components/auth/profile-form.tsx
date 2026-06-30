"use client";

import { useActionState } from "react";

import { updateNicknameAction } from "@/lib/auth/actions";
import { INITIAL_PROFILE_STATE } from "@/lib/auth/action-state";

export function ProfileForm({ initialNickname }: { initialNickname: string }) {
  const [state, formAction, pending] = useActionState(
    updateNicknameAction,
    INITIAL_PROFILE_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nickname" className="text-sm font-semibold">
          닉네임
        </label>
        <input
          id="nickname"
          name="nickname"
          type="text"
          defaultValue={initialNickname}
          minLength={2}
          maxLength={20}
          required
          className="rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--border)" }}
        />
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          2~20자. 다른 사용자와 중복될 수 없어요.
        </p>
      </div>

      {state.status !== "idle" && state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="text-sm"
          style={{ color: state.status === "error" ? "#dc2626" : "#16a34a" }}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md px-4 py-2 text-sm font-bold text-[var(--accent-foreground)] disabled:opacity-60"
        style={{ backgroundColor: "var(--accent)" }}
      >
        {pending ? "저장 중…" : "닉네임 저장"}
      </button>
    </form>
  );
}
