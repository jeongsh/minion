import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = {
  title: "로그인 · MINION",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/me");
  }

  const params = await searchParams;
  const errorParam = params.error;
  const initialError = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  return (
    <AuthPageShell
      title="다시 만나 반가워요"
      description="승부예측, 커뮤니티와 내 LP 기록을 이어서 확인하세요."
    >
      <LoginForm initialError={initialError} />
    </AuthPageShell>
  );
}
