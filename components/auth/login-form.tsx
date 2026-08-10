"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { signInAction } from "@/lib/auth/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/action-state";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialError ? { error: initialError } : INITIAL_AUTH_STATE,
  );
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const emailForm = (
    <form action={formAction} onReset={(event) => event.preventDefault()} className="flex flex-col gap-4">
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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-12 rounded-xl border bg-[var(--ui-surface)] px-3.5 py-2 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
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
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-12 rounded-xl border bg-[var(--ui-surface)] px-3.5 py-2 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
      >
        {pending ? "로그인 중…" : "로그인"}
      </Button>

      <p className="text-sm" style={{ color: "var(--muted)" }}>
        계정이 없으신가요?{" "}
        <Link href="/signup" className="font-semibold underline">
          회원가입
        </Link>
        {" · "}
        <Link href="/forgot-password" className="font-semibold underline">
          비밀번호 재설정
        </Link>
      </p>
    </form>
  );

  return (
    <div className="flex flex-col gap-5">
      {showEmailForm ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setShowEmailForm(false)}
            className="self-start text-sm font-semibold underline"
          >
            ← 소셜 로그인으로 돌아가기
          </button>
          {emailForm}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SocialAuthButtons />
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            className="text-center text-sm font-semibold underline"
          >
            이메일로 로그인하기
          </button>
          <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
            계정이 없으신가요?{" "}
            <Link href="/signup" className="font-semibold underline">
              회원가입
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
