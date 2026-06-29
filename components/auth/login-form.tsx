"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "@/lib/auth/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/action-state";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
    INITIAL_AUTH_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-semibold">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md px-4 py-2 text-sm font-bold text-[var(--accent-foreground)] disabled:opacity-60"
        style={{ backgroundColor: "var(--accent)" }}
      >
        {pending ? "로그인 중…" : "로그인"}
      </button>

      <p className="text-sm" style={{ color: "var(--muted)" }}>
        계정이 없으신가요?{" "}
        <Link href="/signup" className="font-semibold underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}
