import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = {
  title: "로그인 · MINION",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/me");
  }

  return (
    <main className="layout-form flex min-h-[calc(100dvh-3.5rem)] flex-col justify-center py-8 sm:min-h-[calc(100dvh-4rem)]">
      <section className="mx-auto w-full max-w-md rounded-[24px] bg-[var(--ui-surface)] sm:border sm:border-[var(--ui-border)] sm:p-8">
        <p className="text-[13px] font-black tracking-[-0.04em] text-[var(--ui-ink)]">MINION.</p>
        <h1 className="mt-3 text-[26px] font-black tracking-[-0.04em] text-[var(--ui-ink)]">다시 만나 반가워요</h1>
        <p className="mb-7 mt-2 text-sm leading-6 text-[var(--ui-muted)]">승부예측, 커뮤니티와 내 LP 기록을 이어서 확인하세요.</p>
        <LoginForm />
      </section>
    </main>
  );
}
