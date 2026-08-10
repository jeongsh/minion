"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { signUpAction } from "@/lib/auth/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/action-state";

export function SignupForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    initialError ? { error: initialError } : INITIAL_AUTH_STATE,
  );
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const allAgreed = ageConfirmed && termsAccepted && privacyAccepted;

  function toggleAllAgreements(checked: boolean) {
    setAgeConfirmed(checked);
    setTermsAccepted(checked);
    setPrivacyAccepted(checked);
  }

  if (state.message) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 text-center">
        <p className="text-base font-bold">메일함을 확인해주세요</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {state.message}
        </p>
        <Link href="/login" className="mt-2 text-sm font-semibold underline">
          로그인 화면으로
        </Link>
      </div>
    );
  }

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
          autoComplete="new-password"
          minLength={6}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-12 rounded-xl border bg-[var(--ui-surface)] px-3.5 py-2 text-base outline-none focus:border-[var(--accent)] sm:text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          6자 이상 입력해주세요.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
        <legend className="px-1 text-sm font-black text-[var(--ui-ink)]">가입 동의</legend>
        <label className="flex items-start gap-2.5 text-sm font-bold leading-5">
          <input
            type="checkbox"
            checked={allAgreed}
            onChange={(event) => toggleAllAgreements(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--ui-ink)]"
          />
          <span>전체 동의</span>
        </label>
        <div className="h-px bg-[var(--ui-border)]" />
        <label className="flex items-start gap-2.5 text-sm leading-5">
          <input
            name="ageConfirmed"
            type="checkbox"
            checked={ageConfirmed}
            onChange={(event) => setAgeConfirmed(event.target.checked)}
            required
            className="mt-1 h-4 w-4 accent-[var(--ui-ink)]"
          />
          <span>만 14세 이상입니다. <b className="text-red-500">(필수)</b></span>
        </label>
        <label className="flex items-start gap-2.5 text-sm leading-5">
          <input
            name="termsAccepted"
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            required
            className="mt-1 h-4 w-4 accent-[var(--ui-ink)]"
          />
          <span><Link href="/terms" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2">이용약관</Link>에 동의합니다. <b className="text-red-500">(필수)</b></span>
        </label>
        <label className="flex items-start gap-2.5 text-sm leading-5">
          <input
            name="privacyAccepted"
            type="checkbox"
            checked={privacyAccepted}
            onChange={(event) => setPrivacyAccepted(event.target.checked)}
            required
            className="mt-1 h-4 w-4 accent-[var(--ui-ink)]"
          />
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
          <SocialAuthButtons mode="signup" showConsentNotice />
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            className="text-center text-sm font-semibold underline"
          >
            이메일로 회원가입하기
          </button>
          <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="font-semibold underline">
              로그인
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
