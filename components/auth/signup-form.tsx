"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { useActionState, useState } from "react";

import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { Button } from "@/components/ui/button";
import { INITIAL_AUTH_STATE } from "@/lib/auth/action-state";
import { signUpAction } from "@/lib/auth/actions";

export function SignupForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    initialError ? { error: initialError } : INITIAL_AUTH_STATE,
  );
  const [showEmailForm, setShowEmailForm] = useState(false);
  if (state.message) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 text-center">
        <p className="text-base font-bold">메일함을 확인해주세요</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {state.message}
        </p>
        <Link href="/login" className="mt-2 text-sm font-medium underline">
          로그인 화면으로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      {showEmailForm ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowEmailForm(false)}
            className="self-start text-[13px] font-medium text-[var(--ui-muted)] underline underline-offset-2"
          >
            ← 이메일 가입 접기
          </button>
          <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-email" className="text-sm font-medium">
            이메일
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="min-h-12 rounded-xl border bg-[var(--ui-surface)] px-3.5 py-2 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="signup-password" className="text-sm font-medium">
            비밀번호
          </label>
          <input
            id="signup-password"
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

        <fieldset className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3 sm:grid-cols-2">
          <legend className="sr-only">가입 동의</legend>
          <label className="flex items-center gap-2 text-sm leading-5">
            <input
              name="ageConfirmed"
              type="checkbox"
              required
              className="h-4 w-4 shrink-0 accent-[var(--ui-ink)]"
            />
            <span>
              만 14세 이상 <b className="font-medium text-red-500">(필수)</b>
            </span>
          </label>
          <div className="flex items-center gap-2 text-sm leading-5">
            <input
              id="signup-terms"
              name="termsAccepted"
              type="checkbox"
              required
              className="h-4 w-4 shrink-0 accent-[var(--ui-ink)]"
            />
            <label htmlFor="signup-terms">
              이용약관 동의 <b className="font-medium text-red-500">(필수)</b>
            </label>
            <Link href="/terms" target="_blank" rel="noreferrer" className="ml-auto shrink-0 text-[13px] font-medium underline underline-offset-2">
              보기
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm leading-5 sm:col-span-2">
            <input
              id="signup-privacy"
              name="privacyAccepted"
              type="checkbox"
              required
              className="h-4 w-4 shrink-0 accent-[var(--ui-ink)]"
            />
            <label htmlFor="signup-privacy">
              개인정보 수집·이용 동의 <b className="font-medium text-red-500">(필수)</b>
            </label>
            <Link href="/privacy" target="_blank" rel="noreferrer" className="ml-auto shrink-0 text-[13px] font-medium underline underline-offset-2">
              보기
            </Link>
          </div>
        </fieldset>

            <Button type="submit" disabled={pending}>
              {pending ? "가입 중…" : "회원가입"}
            </Button>
          </form>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowEmailForm(true)}
          className="h-12 w-full gap-2 rounded-xl text-[13px] font-medium"
        >
          <Mail size={16} aria-hidden="true" />
          이메일로 가입하기
        </Button>
      )}

      <p className="text-sm" style={{ color: "var(--muted)" }}>
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-medium underline">
          로그인
        </Link>
      </p>

      {!showEmailForm ? (
        <>
          <div className="flex items-center gap-3 text-[13px] font-medium text-[var(--ui-muted)]">
            <span className="h-px flex-1 bg-[var(--ui-border)]" />
            또는
            <span className="h-px flex-1 bg-[var(--ui-border)]" />
          </div>

          <SocialAuthButtons mode="signup" showConsentNotice />
        </>
      ) : null}
    </div>
  );
}
