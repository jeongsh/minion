"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { signUpAction } from "@/lib/auth/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/action-state";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(
    signUpAction,
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
          autoComplete="new-password"
          minLength={6}
          required
          className="min-h-12 rounded-xl border bg-[var(--ui-surface)] px-3.5 py-2 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          6자 이상 입력해주세요.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
        <legend className="px-1 text-sm font-black text-[var(--ui-ink)]">가입 동의</legend>
        <label className="flex items-start gap-2.5 text-sm leading-5">
          <input name="ageConfirmed" type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--ui-ink)]" />
          <span>만 14세 이상입니다. <b className="text-red-500">(필수)</b></span>
        </label>
        <label className="flex items-start gap-2.5 text-sm leading-5">
          <input name="termsAccepted" type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--ui-ink)]" />
          <span><Link href="/terms" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2">이용약관</Link>에 동의합니다. <b className="text-red-500">(필수)</b></span>
        </label>
        <label className="flex items-start gap-2.5 text-sm leading-5">
          <input name="privacyAccepted" type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--ui-ink)]" />
          <span><Link href="/privacy" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2">개인정보 수집·이용 및 처리방침</Link>에 동의합니다. <b className="text-red-500">(필수)</b></span>
        </label>
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
      >
        {pending ? "가입 중…" : "회원가입"}
      </Button>

      <p className="text-sm" style={{ color: "var(--muted)" }}>
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
