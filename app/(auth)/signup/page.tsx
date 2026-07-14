import { redirect } from "next/navigation";

import { SignupForm } from "@/components/auth/signup-form";
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
    <main className="layout-form flex min-h-[calc(100dvh-3.5rem)] flex-col justify-center py-8 sm:min-h-[calc(100dvh-4rem)]">
      <section className="mx-auto w-full max-w-md rounded-[24px] bg-[var(--ui-surface)] sm:border sm:border-[var(--ui-border)] sm:p-8">
        <p className="text-[13px] font-black tracking-[-0.04em] text-[var(--ui-ink)]">MINION.</p>
        <h1 className="mt-3 text-[26px] font-black tracking-[-0.04em] text-[var(--ui-ink)]">응원을 기록으로 남겨요</h1>
        <p className="mb-7 mt-2 text-sm leading-6 text-[var(--ui-muted)]">브론즈부터 시작해 활동과 예측으로 LP와 티어를 쌓을 수 있어요.</p>
        <SignupForm />
      </section>
    </main>
  );
}
