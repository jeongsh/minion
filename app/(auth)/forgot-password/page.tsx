import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = {
  title: "비밀번호 재설정 | MINION",
  description: "MINION 계정의 비밀번호 재설정 메일을 요청합니다.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      title="비밀번호를 다시 찾아볼게요"
      description="가입한 이메일로 비밀번호 재설정 링크를 보내드려요."
    >
      <ForgotPasswordForm />
      <div>
        <Link href="/login" className="mt-5 inline-block text-sm font-bold underline underline-offset-2">
          로그인으로 돌아가기
        </Link>
      </div>
    </AuthPageShell>
  );
}
