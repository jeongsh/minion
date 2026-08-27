"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { signInAction } from "@/lib/auth/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/action-state";

export function LoginForm({ initialError, next = "/" }: { initialError?: string; next?: string }) {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialError ? { error: initialError } : INITIAL_AUTH_STATE,
  );

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="min-h-12 rounded-xl border bg-[var(--ui-surface)] px-3.5 py-2 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="min-h-12 rounded-xl border bg-[var(--ui-surface)] px-3.5 py-2 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "로그인 중…" : "로그인"}
        </Button>

        <p className="text-sm" style={{ color: "var(--muted)" }}>
          계정이 없으신가요?{" "}
          <Link href="/signup" className="font-medium underline">
            회원가입
          </Link>
          {" · "}
          <Link href="/forgot-password" className="font-medium underline">
            비밀번호 재설정
          </Link>
        </p>
      </form>

      <div className="flex items-center gap-3 text-[13px] font-medium text-[var(--ui-muted)]">
        <span className="h-px flex-1 bg-[var(--ui-border)]" />
        또는
        <span className="h-px flex-1 bg-[var(--ui-border)]" />
      </div>

      <SocialAuthButtons next={next} />
    </div>
  );
}
