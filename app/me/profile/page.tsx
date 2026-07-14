import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";
import { ProfileForm } from "@/components/auth/profile-form";

export const metadata = {
  title: "프로필 관리 · MINION",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="layout-form py-16 text-center">
        <h1 className="home-section-title mb-3 text-2xl">프로필 관리</h1>
        <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
          프로필을 관리하려면 로그인이 필요해요.
        </p>
        <Link
          href="/login"
          className="rounded-md px-4 py-2 text-sm font-bold text-[var(--accent-foreground)]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          로그인
        </Link>
      </main>
    );
  }

  return (
    <main className="layout-form py-6 sm:py-10">
      <section
        className="mb-6 rounded-lg border p-5"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <h2 className="mb-1 text-base font-bold">닉네임</h2>
        <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
          커뮤니티에 표시되는 이름이에요. 가입 직후에는 이메일 앞부분으로 임시 설정돼 있어요.
        </p>
        <ProfileForm initialNickname={user.nickname ?? ""} />
      </section>

      <section
        className="rounded-lg border p-5"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <h2 className="mb-1 text-base font-bold">계정</h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          이메일: {user.email ?? "-"}
        </p>
      </section>
    </main>
  );
}
