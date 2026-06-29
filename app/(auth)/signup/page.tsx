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
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <h1 className="mb-2 text-2xl font-black">회원가입</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        가입하면 브론즈 티어부터 시작해요. 활동할수록 LP가 쌓이고 티어가 올라갑니다.
      </p>
      <SignupForm />
    </main>
  );
}
