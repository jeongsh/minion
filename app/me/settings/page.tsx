import { Bell, LockKeyhole, ShieldBan, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteAccountForm } from "@/components/auth/delete-account-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { PasswordForm } from "@/components/auth/password-form";
import { ProfileForm } from "@/components/auth/profile-form";
import { BlockedUserList } from "@/components/community/blocked-user-list";
import { NotificationSettingsForm } from "@/components/notifications/notification-settings-form";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/current-user";
import { listBlockedCommunityGuests } from "@/lib/data/community-guests";
import { listBlockedCommunityUsers } from "@/lib/data/community-users";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { getRankSummary } from "@/lib/rank/queries";

const REAUTH_WINDOW_MS = 5 * 60 * 1000;

const SOCIAL_PROVIDER_LABELS: Record<string, string> = {
  google: "구글",
  kakao: "카카오",
  "custom:naver": "네이버",
  apple: "Apple",
};

const SECTIONS = [
  { href: "#profile", label: "프로필", icon: UserRound },
  { href: "#notifications", label: "알림", icon: Bell },
  { href: "#blocks", label: "차단 관리", icon: ShieldBan },
  { href: "#account", label: "계정 및 보안", icon: LockKeyhole },
];

function isRecentlyReauthenticated(user: CurrentUser) {
  if (user.hasPassword || !user.lastSignInAt) return false;
  return Date.now() - new Date(user.lastSignInAt).getTime() < REAUTH_WINDOW_MS;
}

export const metadata = {
  title: "설정 · MINION",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me/settings");

  const [summary, preferences, blockedUsers, blockedGuests] = await Promise.all([
    getRankSummary(user.id),
    getNotificationPreferences(),
    listBlockedCommunityUsers(user.id),
    listBlockedCommunityGuests(user.id),
  ]);

  return (
    <main className="layout-wide me-page max-w-5xl py-5 sm:py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/me" className="text-[13px] font-bold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">← 마이 홈</Link>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--ui-ink)] sm:text-3xl">설정</h1>
          <p className="mt-1 text-sm text-[var(--ui-muted)]">프로필, 알림과 계정 환경을 관리합니다.</p>
        </div>
        <LogoutButton className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm font-bold text-[var(--ui-muted)] transition hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]" />
      </header>

      <div className="grid items-start gap-5 md:grid-cols-[190px_minmax(0,1fr)]">
        <nav className="sticky top-20 hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 md:block" aria-label="설정 메뉴">
          {SECTIONS.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[var(--ui-muted)] transition hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]">
              <Icon size={17} />{label}
            </a>
          ))}
        </nav>

        <div className="min-w-0 space-y-4 sm:space-y-6">
          <SettingsSection id="profile" title="프로필" description="MINION과 커뮤니티에서 보이는 정보를 변경합니다.">
            <ProfileForm initialNickname={user.nickname ?? ""} initialProfileImageUrl={user.profileImageUrl} tier={summary.tier} />
          </SettingsSection>

          <SettingsSection id="notifications" title="알림" description="놓치고 싶지 않은 경기 소식만 골라서 받아보세요.">
            <NotificationSettingsForm initialPreferences={preferences} />
          </SettingsSection>

          <SettingsSection id="blocks" title="차단 관리" description="차단한 사용자의 글과 댓글은 내 화면에 표시되지 않습니다.">
            <BlockedUserList users={blockedUsers} guests={blockedGuests} />
          </SettingsSection>

          <SettingsSection id="account" title="계정 및 보안" description={user.hasPassword ? "가입 이메일과 비밀번호를 관리합니다." : "연결된 소셜 로그인 계정을 확인합니다."}>
            <div className="rounded-xl bg-[var(--ui-surface-muted)] p-4">
              <p className="text-[13px] font-bold text-[var(--ui-muted)]">로그인 계정</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ui-ink)]">
                {user.hasPassword
                  ? user.email ?? "이메일 정보 없음"
                  : `${(user.authProvider ? SOCIAL_PROVIDER_LABELS[user.authProvider] : undefined) ?? "소셜"} 로그인`}
              </p>
            </div>
            {user.hasPassword ? <div className="mt-6 border-t border-[var(--ui-border)] pt-6"><h3 className="mb-1 text-sm font-bold">비밀번호 변경</h3><p className="mb-4 text-[13px] text-[var(--ui-muted)]">보안을 위해 현재 비밀번호를 다시 확인합니다.</p><PasswordForm /></div> : null}
            <div className="mt-8 border-t border-[var(--ui-border)] pt-6">
              <h3 className="text-sm font-bold text-[#dc2626]">회원 탈퇴</h3>
              <div className="mt-3"><DeleteAccountForm hasPassword={user.hasPassword} authProvider={user.authProvider} recentlyReauthenticated={isRecentlyReauthenticated(user)} /></div>
            </div>
          </SettingsSection>
        </div>
      </div>
    </main>
  );
}

function SettingsSection({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="me-card scroll-mt-24 rounded-2xl border p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-black tracking-[-0.02em] text-[var(--ui-ink)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--ui-muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}
