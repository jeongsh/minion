import { Bell, ChevronRight, FileText, LockKeyhole, LogOut, ShieldBan, Sticker, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteAccountForm } from "@/components/auth/delete-account-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { PasswordForm } from "@/components/auth/password-form";
import { ProfileForm } from "@/components/auth/profile-form";
import { BlockedUserList } from "@/components/community/blocked-user-list";
import { NotificationSettingsForm } from "@/components/notifications/notification-settings-form";
import { CheckInButton } from "@/components/rank/check-in-button";
import { RankAvatar } from "@/components/rank/rank-avatar";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/current-user";
import { listBlockedCommunityGuests } from "@/lib/data/community-guests";
import { listBlockedCommunityUsers } from "@/lib/data/community-users";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { getTeamNotificationPreferences } from "@/lib/notifications/team-preferences";
import { tierProgress } from "@/lib/rank/config";
import { getRankSummary } from "@/lib/rank/queries";

export const metadata = { title: "내 계정 · MINION" };

const REAUTH_WINDOW_MS = 5 * 60 * 1000;

const SOCIAL_PROVIDER_LABELS: Record<string, string> = {
  google: "구글",
  kakao: "카카오",
  "custom:naver": "네이버",
  apple: "Apple",
};

const MANAGE_LINKS = [
  { href: "#profile", label: "프로필", mobileLabel: "프로필", icon: UserRound },
  { href: "/me/minicons", label: "내 미니콘", mobileLabel: "미니콘", icon: Sticker },
  { href: "#notifications", label: "알림", mobileLabel: "알림", icon: Bell },
  { href: "#blocks", label: "차단 관리", mobileLabel: "차단 관리", icon: ShieldBan },
  { href: "#account", label: "계정 및 보안", mobileLabel: "계정·보안", icon: LockKeyhole },
];

function isRecentlyReauthenticated(user: CurrentUser) {
  if (user.hasPassword || !user.lastSignInAt) return false;
  return Date.now() - new Date(user.lastSignInAt).getTime() < REAUTH_WINDOW_MS;
}

function accountLabel(user: CurrentUser) {
  if (user.hasPassword) return user.email ?? "이메일 정보 없음";
  return `${(user.authProvider ? SOCIAL_PROVIDER_LABELS[user.authProvider] : undefined) ?? "소셜"} 로그인`;
}

export default async function MePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  if (tab === "account") redirect("/me#account");
  if (tab === "blocks") redirect("/me#blocks");

  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="layout-form py-16 text-center">
        <h1 className="home-section-title mb-3 text-2xl">내 계정</h1>
        <p className="mb-6 text-sm text-[var(--ui-muted)]">내 정보와 설정을 관리하려면 로그인이 필요합니다.</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/login?next=/me" className="flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-foreground)]">로그인</Link>
          <Link href="/signup" className="flex min-h-11 items-center justify-center rounded-lg border border-[var(--ui-border)] px-5 text-sm font-bold">회원가입</Link>
        </div>
      </main>
    );
  }

  const [summary, preferences, teamNotificationPreferences, blockedUsers, blockedGuests] = await Promise.all([
    getRankSummary(user.id),
    getNotificationPreferences(),
    getTeamNotificationPreferences(),
    listBlockedCommunityUsers(user.id),
    listBlockedCommunityGuests(user.id),
  ]);
  const progress = tierProgress(summary.tier, summary.lp);
  const initials = (user.nickname ?? "MY").slice(0, 2).toUpperCase();

  return (
    <main className="layout-wide me-page max-w-6xl pb-6 pt-3 sm:py-8">
      <MobileAccountSummary user={user} summary={summary} progress={progress} initials={initials} />

      <nav className="mt-2.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 lg:hidden" aria-label="내 계정 메뉴">
        <div className="grid grid-cols-5 gap-1.5">
          {MANAGE_LINKS.map(({ href, mobileLabel, icon: Icon }) => (
            <a key={href} href={href} className="flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-lg bg-[var(--ui-surface-muted)] px-1 text-[13px] font-medium leading-[18px] text-[var(--ui-text)]">
              <Icon size={13} className="shrink-0" /><span className="truncate">{mobileLabel}</span>
            </a>
          ))}
        </div>
      </nav>

      <div className="mt-2.5 grid items-start gap-5 sm:mt-5 lg:mt-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block">
          <section className="me-card overflow-hidden rounded-2xl border">
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-4 lg:flex-col lg:text-center">
                <RankAvatar tier={summary.tier} src={user.profileImageUrl} alt="" fallback={initials} size="lg" />
                <div className="min-w-0 flex-1 lg:w-full">
                  <h1 className="truncate text-xl font-black tracking-[-0.03em] text-[var(--ui-ink)]">{user.nickname ?? "MINION 팬"}</h1>
                  <p className="mt-1 truncate text-[13px] text-[var(--ui-muted)]">{accountLabel(user)}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-[var(--ui-surface-muted)] p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-[var(--ui-ink)]">{progress.label}</span>
                  <span className="font-black tabular-nums text-[var(--ui-ink)]">{summary.lp.toLocaleString("ko-KR")} LP</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--ui-border)]">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.round(progress.progressRatio * 100)}%` }} />
                </div>
                <p className="mt-2 text-[12px] font-medium text-[var(--ui-muted)]">
                  {summary.overallRank ? `전체 ${summary.overallRank.toLocaleString("ko-KR")}위` : "활동하며 LP를 모아보세요"}
                </p>
              </div>

              <div className="mt-4"><CheckInButton alreadyChecked={summary.checkedInToday} /></div>
            </div>
          </section>

          <nav className="me-card rounded-2xl border p-2" aria-label="내 계정 메뉴">
            <div className="grid grid-cols-2 lg:block">
              {MANAGE_LINKS.map(({ href, label, icon: Icon }) => (
                <a key={href} href={href} className="group flex min-h-12 items-center gap-2.5 rounded-xl px-3 text-sm font-bold text-[var(--ui-muted)] transition hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]">
                  <Icon size={17} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <ChevronRight size={15} className="hidden shrink-0 opacity-45 lg:block" />
                </a>
              ))}
            </div>
            <div className="mx-2 my-2 border-t border-[var(--ui-border)]" />
            <Link href={`/community/user/${user.id}`} className="flex min-h-12 items-center gap-2.5 rounded-xl px-3 text-sm font-bold text-[var(--ui-muted)] transition hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]">
              <FileText size={17} /><span className="min-w-0 flex-1">내 커뮤니티 활동</span><ChevronRight size={15} className="opacity-45" />
            </Link>
            <div className="mx-2 my-2 border-t border-[var(--ui-border)]" />
            <div className="flex min-h-12 items-center gap-2.5 rounded-xl px-3 text-sm font-bold text-[#dc2626] transition hover:bg-[color-mix(in_srgb,#dc2626_8%,transparent)]">
              <LogOut size={17} />
              <LogoutButton className="flex-1 text-left" />
            </div>
          </nav>
        </aside>

        <div className="min-w-0">
          <div className="space-y-2.5 sm:space-y-5">
            <AccountSection id="profile" icon={UserRound} title="프로필" description="닉네임과 프로필 이미지를 변경합니다.">
              <ProfileForm initialNickname={user.nickname ?? ""} initialProfileImageUrl={user.profileImageUrl} tier={summary.tier} />
            </AccountSection>

            <AccountSection id="notifications" icon={Bell} title="알림" description="팔로우한 팀별로 받을 알림을 선택합니다.">
              <NotificationSettingsForm initialPreferences={preferences} initialTeams={teamNotificationPreferences} />
            </AccountSection>

            <AccountSection id="blocks" icon={ShieldBan} title="차단 관리" description="차단한 사용자와 해제할 사용자를 관리합니다.">
              <BlockedUserList users={blockedUsers} guests={blockedGuests} />
            </AccountSection>

            <AccountSection id="account" icon={LockKeyhole} title="계정 및 보안" description="로그인 정보와 보안 설정을 확인합니다.">
              <div className="rounded-xl bg-[var(--ui-surface-muted)] p-4">
                <p className="text-[13px] font-medium text-[var(--ui-muted)]">로그인 계정</p>
                <p className="mt-1 break-all text-sm font-medium text-[var(--ui-ink)]">{accountLabel(user)}</p>
              </div>

              {user.hasPassword ? (
                <details className="group mt-4 rounded-xl border border-[var(--ui-border)]">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[13px] font-medium text-[var(--ui-ink)] sm:min-h-14 sm:text-sm [&::-webkit-details-marker]:hidden">
                    비밀번호 변경 <ChevronRight size={17} className="text-[var(--ui-muted)] transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="border-t border-[var(--ui-border)] p-4"><PasswordForm /></div>
                </details>
              ) : null}

              <details className="group mt-3 rounded-xl border border-[color-mix(in_srgb,#dc2626_28%,var(--ui-border))]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[13px] font-medium text-[#dc2626] sm:min-h-14 sm:text-sm [&::-webkit-details-marker]:hidden">
                  회원 탈퇴 <ChevronRight size={17} className="transition-transform group-open:rotate-90" />
                </summary>
                <div className="border-t border-[color-mix(in_srgb,#dc2626_20%,var(--ui-border))] p-4">
                  <DeleteAccountForm hasPassword={user.hasPassword} authProvider={user.authProvider} recentlyReauthenticated={isRecentlyReauthenticated(user)} />
                </div>
              </details>
            </AccountSection>
          </div>
        </div>
      </div>
    </main>
  );
}

function AccountSection({ id, icon: Icon, title, description, children }: {
  id: string;
  icon: typeof UserRound;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="me-card scroll-mt-28 rounded-xl border p-4 sm:scroll-mt-24 sm:rounded-2xl sm:p-6">
      <div className="mb-4 flex items-start gap-2 sm:mb-5 sm:gap-3">
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-[var(--ui-surface-muted)] text-[var(--ui-muted)] sm:h-10 sm:w-10 sm:rounded-xl"><Icon size={16} /></span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-black leading-[22px] tracking-[-0.02em] text-[var(--ui-ink)] sm:text-lg">{title}</h3>
          <p className="text-[13px] font-medium leading-[18px] text-[var(--ui-muted)] sm:mt-0.5 sm:text-sm sm:font-normal sm:leading-5">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function MobileAccountSummary({ user, summary, progress, initials }: {
  user: CurrentUser;
  summary: Awaited<ReturnType<typeof getRankSummary>>;
  progress: ReturnType<typeof tierProgress>;
  initials: string;
}) {
  return (
    <section className="me-card rounded-xl border p-4 lg:hidden">
      <div className="flex items-center gap-2.5">
        <RankAvatar tier={summary.tier} src={user.profileImageUrl} alt="" fallback={initials} size="mobile" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-black leading-[22px] tracking-[-0.02em] text-[var(--ui-ink)]">{user.nickname ?? "MINION 팬"}</h1>
          <p className="truncate text-[13px] font-medium leading-[18px] text-[var(--ui-muted)]">{accountLabel(user)}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-medium leading-[18px]">
            <span className="text-[var(--ui-ink)]">{progress.label}</span>
            <span className="text-[var(--ui-muted)]">{summary.lp.toLocaleString("ko-KR")} LP</span>
            {summary.overallRank ? <span className="text-[var(--ui-muted)]">전체 {summary.overallRank.toLocaleString("ko-KR")}위</span> : null}
          </div>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.round(progress.progressRatio * 100)}%` }} />
      </div>
      <div className="mt-2"><CheckInButton alreadyChecked={summary.checkedInToday} /></div>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <Link href={`/community/user/${user.id}`} className="flex min-h-9 items-center justify-center gap-1 rounded-lg bg-[var(--ui-surface-muted)] px-2 text-[13px] font-medium text-[var(--ui-text)]">
          <FileText size={14} />내 활동
        </Link>
        <div className="flex min-h-9 items-center justify-center gap-1 rounded-lg bg-[var(--ui-surface-muted)] px-2 text-[13px] font-medium text-[#dc2626]">
          <LogOut size={14} /><LogoutButton className="text-[13px] font-medium text-[#dc2626]" />
        </div>
      </div>
    </section>
  );
}
