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
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <h1 className="mb-6 text-2xl font-black">로그인</h1>
      <LoginForm />
    </main>
  );
}
