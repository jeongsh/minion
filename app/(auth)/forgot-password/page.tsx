import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "비밀번호 재설정 | MINION",
  description: "MINION 계정의 비밀번호 재설정 메일을 요청합니다.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="layout-reading py-20">
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ui-muted)]">Account Recovery</p>
        <h1 className="mt-3 text-2xl font-black text-[var(--ui-ink)]">비밀번호 재설정</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-[var(--ui-muted)]">
          가입 이메일을 입력하면 비밀번호 재설정 링크를 보냅니다.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
        <Link href="/login" className="mt-5 inline-block text-sm font-bold underline underline-offset-2">
          로그인으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
