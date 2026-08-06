"use client";

import Link from "next/link";

import {
  signInWithGoogleAction,
  signInWithKakaoAction,
  signInWithNaverAction,
} from "@/lib/auth/actions";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.87 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#191600"
        d="M9 2C4.58 2 1 4.77 1 8.2c0 2.19 1.47 4.11 3.68 5.22-.16.58-.6 2.16-.69 2.5-.11.42.15.42.32.3.13-.09 2.1-1.42 2.95-2 .89.13 1.8.2 2.74.2 4.42 0 8-2.77 8-6.22C18 4.77 14.42 2 9 2Z"
      />
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
      <path fill="#fff" d="M8.24 0v6.4L4.09 0H0v14h4.09V7.6L8.24 14H12.33V0H8.24Z" />
    </svg>
  );
}

export function SocialAuthButtons({
  showConsentNotice = false,
  mode = "login",
}: {
  showConsentNotice?: boolean;
  mode?: "login" | "signup";
}) {
  const actionLabel = mode === "signup" ? "회원가입" : "계속하기";

  return (
    <div className="flex flex-col gap-2">
      <form action={signInWithGoogleAction}>
        <button
          type="submit"
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#747775] bg-white text-[13px] font-semibold text-[#1f1f1f] transition hover:bg-[#f7f7f7] active:scale-[0.99] dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1b1b1b]"
        >
          <GoogleIcon />
          구글로 {actionLabel}
        </button>
      </form>
      <form action={signInWithKakaoAction}>
        <button
          type="submit"
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] text-[13px] font-semibold text-[#191600] transition hover:brightness-95 active:scale-[0.99]"
        >
          <KakaoIcon />
          카카오로 {actionLabel}
        </button>
      </form>
      <form action={signInWithNaverAction}>
        <button
          type="submit"
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#03C75A] text-[13px] font-semibold text-white transition hover:brightness-95 active:scale-[0.99]"
        >
          <NaverIcon />
          네이버로 {actionLabel}
        </button>
      </form>

      {showConsentNotice ? (
        <p className="text-center text-[12px] leading-5 text-[var(--ui-muted)]">
          계속 진행하면 만 14세 이상이며{" "}
          <Link href="/terms" target="_blank" rel="noreferrer" className="underline underline-offset-2">이용약관</Link>
          {" 및 "}
          <Link href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2">개인정보처리방침</Link>
          에 동의하는 것으로 간주합니다.
        </p>
      ) : null}
    </div>
  );
}
