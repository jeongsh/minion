"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { INITIAL_AUTH_STATE } from "@/lib/auth/action-state";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, INITIAL_AUTH_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        이메일
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="min-h-12 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3.5 py-2 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm font-semibold text-emerald-600">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "발송 중..." : "재설정 메일 받기"}
      </Button>
    </form>
  );
}
