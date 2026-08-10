import Link from "next/link";

import { DeleteAccountForm } from "@/components/auth/delete-account-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { PasswordForm } from "@/components/auth/password-form";
import { ProfileForm } from "@/components/auth/profile-form";
import { BlockedUserList } from "@/components/community/blocked-user-list";
import { CheckInButton } from "@/components/rank/check-in-button";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/current-user";
import { tierProgress, type Tier } from "@/lib/rank/config";
import { getRankSummary } from "@/lib/rank/queries";
import { listBlockedCommunityUsers } from "@/lib/data/community-users";
import { listBlockedCommunityGuests } from "@/lib/data/community-guests";

// 회원 탈퇴 재인증(delete-account-form.tsx)에서 소셜 재로그인 후 이 시간 안에는
// "방금 본인임을 증명했다"고 보고 비밀번호 없이 탈퇴를 진행할 수 있게 한다.
const REAUTH_WINDOW_MS = 5 * 60 * 1000;

function isRecentlyReauthenticated(user: CurrentUser) {
  if (user.hasPassword || !user.lastSignInAt) return false;
  return Date.now() - new Date(user.lastSignInAt).getTime() < REAUTH_WINDOW_MS;
}

export const metadata = {
  title: "마이랭크 · MINION",
};

// delete-account-form.tsx의 PROVIDER_INFO와 같은 provider 키를 쓴다(app_metadata.provider 원본 값).
const SOCIAL_PROVIDER_LABELS: Record<string, string> = {
  google: "구글",
  kakao: "카카오",
  "custom:naver": "네이버",
  apple: "Apple",
};

const REASON_LABELS: Record<string, string> = {
  attendance: "출석체크",
  post_created: "글 작성",
  comment_created: "댓글 작성",
  honor_received: "추천 받음",
  honor_removed: "추천 취소",
  dishonor_received: "비추천 받음",
  dishonor_removed: "비추천 취소",
  reported: "신고 제재",
  prediction_bet_placed: "승부예측 참가",
  prediction_bet_cancelled: "승부예측 취소",
  prediction_bet_won: "승부예측 적중",
  prediction_bet_refunded: "승부예측 환불",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type MeTab = "rank" | "account" | "blocks";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab: MeTab = params.tab === "account" ? "account" : params.tab === "blocks" ? "blocks" : "rank";
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="layout-form py-16 text-center">
        <h1 className="home-section-title mb-3 text-2xl">마이랭크</h1>
        <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
          랭크와 LP를 보려면 로그인이 필요합니다.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-bold text-[var(--accent-foreground)]"
            style={{ backgroundColor: "var(--accent)" }}
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-bold"
            style={{ borderColor: "var(--border)" }}
          >
            회원가입
          </Link>
        </div>
      </main>
    );
  }

  const summary = await getRankSummary(user.id);
  const [blockedUsers, blockedGuests] = tab === "blocks"
    ? await Promise.all([listBlockedCommunityUsers(user.id), listBlockedCommunityGuests(user.id)])
    : [[], []];
  const progress = tierProgress(summary.tier, summary.lp);

  return (
    <main className="layout-form me-page py-5 sm:py-8">
      <header className="me-card mb-5 rounded-2xl border p-5 sm:mb-6 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[var(--ui-muted)]">MINION 계정</p>
            <h1 className="mt-1 text-2xl font-black text-[var(--ui-ink)]">마이페이지</h1>
            <p className="mt-1 text-sm text-[var(--ui-muted)]">
              랭크, 프로필, 보안 설정을 한 곳에서 관리합니다.
            </p>
          </div>
          <LogoutButton className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm font-bold text-[var(--ui-muted)] transition hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]" />
        </div>

        <nav
          className="me-tabs mt-5 grid grid-cols-3 gap-1 rounded-xl bg-[var(--ui-surface-muted)] p-1"
          aria-label="마이페이지 탭"
        >
          <TabLink href="/me" label="마이랭크" active={tab === "rank"} />
          <TabLink href="/me?tab=account" label="개인정보 수정" active={tab === "account"} />
          <TabLink href="/me?tab=blocks" label="차단 관리" active={tab === "blocks"} />
        </nav>
      </header>

      {tab === "account" ? (
        <AccountPanel
          email={user.email}
          nickname={user.nickname ?? ""}
          profileImageUrl={user.profileImageUrl}
          tier={summary.tier}
          hasPassword={user.hasPassword}
          authProvider={user.authProvider}
          recentlyReauthenticated={isRecentlyReauthenticated(user)}
        />
      ) : tab === "blocks" ? (
        <section className="me-card rounded-2xl border p-5 sm:p-6">
          <h2 className="text-base font-bold">차단한 사용자</h2>
          <p className="mt-1 text-sm text-[var(--ui-muted)]">차단한 사용자의 글과 댓글은 내 화면에 표시되지 않습니다.</p>
          <div className="mt-4"><BlockedUserList users={blockedUsers} guests={blockedGuests} /></div>
        </section>
      ) : (
        <RankPanel summary={summary} progress={progress} />
      )}
    </main>
  );
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-bold transition ${
        active
          ? "bg-[var(--ui-surface)] text-[var(--ui-ink)] shadow-[0_1px_0_rgb(24_25_28_/_0.05)]"
          : "text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
      }`}
    >
      {label}
    </Link>
  );
}

function AccountPanel({
  email,
  nickname,
  profileImageUrl,
  tier,
  hasPassword,
  authProvider,
  recentlyReauthenticated,
}: {
  email: string | null;
  nickname: string;
  profileImageUrl: string | null;
  tier: Tier;
  hasPassword: boolean;
  authProvider: string | null;
  recentlyReauthenticated: boolean;
}) {
  return (
    <>
      <section
        className="me-card mb-4 rounded-2xl border p-5 sm:mb-6 sm:p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <div className="mb-4">
          <h2 className="text-base font-bold">프로필</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            헤더와 커뮤니티에 표시되는 닉네임과 프로필 이미지를 변경합니다.
          </p>
        </div>
        <ProfileForm
          initialNickname={nickname}
          initialProfileImageUrl={profileImageUrl}
          tier={tier}
        />
      </section>

      <section
        className="me-card mb-4 rounded-2xl border p-5 sm:mb-6 sm:p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <div className="mb-4">
          <h2 className="text-base font-bold">
            계정
            {hasPassword ? null : (
              <>
                {" "}
                ·{" "}
                {(authProvider ? SOCIAL_PROVIDER_LABELS[authProvider] : undefined) ?? "소셜"}{" "}
                로그인
              </>
            )}
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {hasPassword
              ? "가입 이메일은 변경할 수 없습니다."
              : "소셜 로그인 계정은 로그인 수단을 변경할 수 없습니다."}
          </p>
        </div>
        {hasPassword ? (
          <p className="text-sm font-semibold">{email ?? "이메일 정보 없음"}</p>
        ) : null}
      </section>

      {hasPassword ? (
        <section
          className="me-card mb-4 rounded-2xl border p-5 sm:mb-6 sm:p-6"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
        >
          <div className="mb-4">
            <h2 className="text-base font-bold">비밀번호 변경</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              보안을 위해 현재 비밀번호를 다시 확인합니다.
            </p>
          </div>
          <PasswordForm />
        </section>
      ) : null}

      <section
        className="me-card rounded-2xl border p-5 sm:p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <div className="mb-4">
          <h2 className="text-base font-bold">회원 탈퇴</h2>
        </div>
        <DeleteAccountForm
          hasPassword={hasPassword}
          authProvider={authProvider}
          recentlyReauthenticated={recentlyReauthenticated}
        />
      </section>
    </>
  );
}

function RankPanel({
  summary,
  progress,
}: {
  summary: Awaited<ReturnType<typeof getRankSummary>>;
  progress: ReturnType<typeof tierProgress>;
}) {
  return (
    <>
      <section className="me-card mb-4 rounded-2xl border p-0 sm:mb-6">
        <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <span className="text-base font-bold">{progress.label}</span>
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {summary.lp.toLocaleString()} LP
                {summary.overallRank ? ` · 전체 ${summary.overallRank}위` : ""}
              </span>
            </div>

            <div
              className="h-2.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--surface-muted)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(progress.progressRatio * 100)}%`,
                  backgroundColor: "var(--accent)",
                }}
              />
            </div>

            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              {progress.nextTier && progress.nextThreshold !== null
                ? `다음 티어(${progress.nextTierLabel})까지 ${
                    progress.nextThreshold - summary.lp
                  } LP`
                : "최고 티어에 도달했어요."}
            </p>
          </div>

          <div className="border-t border-[var(--ui-border)] p-5 sm:border-l sm:border-t-0 sm:p-6">
            <h2 className="mb-3 text-base font-bold">출석체크</h2>
            <CheckInButton alreadyChecked={summary.checkedInToday} />
          </div>
        </div>
      </section>

      <section
        className="me-card rounded-2xl border p-0"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <h2 className="px-5 pb-1 pt-5 text-base font-bold sm:px-6 sm:pt-6">최근 LP 변동</h2>
        {summary.recentLedger.length === 0 ? (
          <div className="px-5 pb-5 pt-3 sm:px-6">
            <KitschEmptyState character="flag" title="LP 로그가 아직 깨끗해요" body="출석체크나 예측에 참여하면 여기에 기록이 쌓여요." compact />
          </div>
        ) : (
          <ul className="me-ledger-list flex flex-col px-5 pb-4 sm:px-6 sm:pb-5">
            {summary.recentLedger.map((entry) => (
              <li
                key={entry.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm"
              >
                <span className="min-w-0 truncate font-medium">{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <span
                    className="font-bold"
                    style={{ color: entry.delta >= 0 ? "#16a34a" : "#dc2626" }}
                  >
                    {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                  </span>
                  <span style={{ color: "var(--muted)" }}>
                    {formatDate(entry.created_at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
