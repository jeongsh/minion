import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = {
  title: "새 비밀번호 설정 | MINION",
  description: "MINION 계정의 새 비밀번호를 설정합니다.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthPageShell
      title="새 비밀번호를 정해주세요"
      description="앞으로 사용할 비밀번호를 두 번 입력하면 바로 변경돼요."
      character="flag"
    >
      <ResetPasswordForm />
    </AuthPageShell>
  );
}
