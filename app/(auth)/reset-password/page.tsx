import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "새 비밀번호 설정 | MINION",
  description: "MINION 계정의 새 비밀번호를 설정합니다.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="layout-reading py-20">
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ui-muted)]">Password Reset</p>
        <h1 className="mt-3 text-2xl font-black text-[var(--ui-ink)]">새 비밀번호 설정</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-[var(--ui-muted)]">
          메일 링크 인증이 완료된 세션에서 새 비밀번호를 저장합니다.
        </p>
        <div className="mt-6">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
