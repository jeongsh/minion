"use client";

import Link from "next/link";
import { GoogleIcon, KakaoIcon, NaverIcon } from "@/components/auth/social-provider-icons";
import { useSyncExternalStore } from "react";

import {
  signInWithAppleAction,
  signInWithGoogleAction,
  signInWithKakaoAction,
  signInWithNaverAction,
} from "@/lib/auth/actions";

function useIsIPhone() {
  return useSyncExternalStore(
    () => () => {},
    () => /iPhone/.test(navigator.userAgent),
    () => false,
  );
}

function AppleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 17 20" aria-hidden="true">
      <path
        fill="#fff"
        d="M14.13 10.6c-.02-2.05 1.68-3.03 1.75-3.08-.96-1.4-2.45-1.6-2.98-1.62-1.27-.13-2.48.75-3.12.75-.65 0-1.63-.73-2.68-.71-1.38.02-2.65.8-3.35 2.03-1.43 2.48-.36 6.14 1.02 8.15.68.98 1.48 2.08 2.54 2.04 1.02-.04 1.4-.66 2.64-.66 1.22 0 1.58.66 2.66.63 1.1-.02 1.79-1 2.46-1.99.78-1.13 1.1-2.24 1.11-2.29-.02-.01-2.13-.82-2.05-3.25ZM12.06 3.98c.56-.68.93-1.62.83-2.56-.8.03-1.78.53-2.36 1.2-.52.6-.97 1.56-.85 2.48.9.07 1.82-.46 2.38-1.12Z"
      />
    </svg>
  );
}

export function SocialAuthButtons({
  showConsentNotice = false,
  mode = "login",
  next: requestedNext,
}: {
  showConsentNotice?: boolean;
  mode?: "login" | "signup";
  next?: string;
}) {
  const actionLabel = mode === "signup" ? "회원가입" : "계속하기";
  const next = requestedNext ?? (mode === "signup" ? "/onboarding/favorite-team" : undefined);
  const isIPhone = useIsIPhone();

  return (
    <div className="flex flex-col gap-2">
      {isIPhone ? (
        <form action={signInWithAppleAction}>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <button
            type="submit"
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-black text-[13px] font-medium text-white transition hover:brightness-110 active:scale-[0.99]"
          >
            <AppleIcon />
            Apple로 {actionLabel}
          </button>
        </form>
      ) : null}
      <form action={signInWithGoogleAction}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <button
          type="submit"
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#747775] bg-white text-[13px] font-medium text-[#1f1f1f] transition hover:bg-[#f7f7f7] active:scale-[0.99] dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1b1b1b]"
        >
          <GoogleIcon />
          구글로 {actionLabel}
        </button>
      </form>
      <form action={signInWithKakaoAction}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <button
          type="submit"
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] text-[13px] font-medium text-[#191600] transition hover:brightness-95 active:scale-[0.99]"
        >
          <KakaoIcon />
          카카오로 {actionLabel}
        </button>
      </form>
      <form action={signInWithNaverAction}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <button
          type="submit"
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#03C75A] text-[13px] font-medium text-white transition hover:brightness-95 active:scale-[0.99]"
        >
          <NaverIcon />
          네이버로 {actionLabel}
        </button>
      </form>

      {showConsentNotice ? (
        <p className="text-center text-[13px] leading-5 text-[var(--ui-muted)]">
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
