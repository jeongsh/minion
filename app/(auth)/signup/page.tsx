import { redirect } from "next/navigation";

import { SignupForm } from "@/components/auth/signup-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = {
  title: "회원가입 · MINION",
};

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/me");
  }

  return (
    <AuthPageShell
      title="응원을 기록으로 남겨요"
      description="브론즈부터 시작해 활동과 예측으로 LP와 티어를 쌓을 수 있어요."
      character="flag"
    >
      <SignupForm />
    </AuthPageShell>
  );
}
