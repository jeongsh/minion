"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { INITIAL_AUTH_STATE } from "@/lib/auth/action-state";
import { resetPasswordAction } from "@/lib/auth/actions";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, INITIAL_AUTH_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        새 비밀번호
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          className="min-h-12 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3.5 py-2 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        새 비밀번호 확인
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          className="min-h-12 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3.5 py-2 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "저장 중..." : "새 비밀번호 저장"}
      </Button>
    </form>
  );
}
