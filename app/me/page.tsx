import Link from "next/link";

import { DeleteAccountForm } from "@/components/auth/delete-account-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { PasswordForm } from "@/components/auth/password-form";
import { ProfileForm } from "@/components/auth/profile-form";
import { CheckInButton } from "@/components/rank/check-in-button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { tierProgress, type Tier } from "@/lib/rank/config";
import { getRankSummary } from "@/lib/rank/queries";

export const metadata = {
  title: "마이랭크 · MINION",
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

type MeTab = "rank" | "account";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab: MeTab = params.tab === "account" ? "account" : "rank";
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
  const progress = tierProgress(summary.tier, summary.lp);

  return (
    <main className="layout-form py-6 sm:py-10">
      <header className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
        <div className="hidden shrink-0 sm:block">
          <LogoutButton />
        </div>
      </header>

      <nav
        className="mb-5 flex items-center gap-2 border-b sm:mb-8"
        style={{ borderColor: "var(--border)" }}
        aria-label="마이페이지 탭"
      >
        <TabLink href="/me" label="마이랭크" active={tab === "rank"} />
        <TabLink href="/me?tab=account" label="개인정보 수정" active={tab === "account"} />
      </nav>

      {tab === "account" ? (
        <AccountPanel
          email={user.email}
          nickname={user.nickname ?? ""}
          profileImageUrl={user.profileImageUrl}
          tier={summary.tier}
        />
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
      className={`relative flex min-h-11 items-center px-3 text-sm font-bold transition-colors ${
        active
          ? "text-[var(--ui-ink)] after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:bg-[var(--ui-ink)]"
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
}: {
  email: string | null;
  nickname: string;
  profileImageUrl: string | null;
  tier: Tier;
}) {
  return (
    <>
      <section
        className="mb-5 rounded-2xl border p-5 sm:mb-8"
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
        className="mb-5 rounded-2xl border p-5 sm:mb-8"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <div className="mb-4">
          <h2 className="text-base font-bold">계정</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            가입 이메일은 변경할 수 없습니다.
          </p>
        </div>
        <p className="text-sm font-semibold">{email ?? "이메일 정보 없음"}</p>
      </section>

      <section
        className="mb-5 rounded-2xl border p-5 sm:mb-8"
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

      <section
        className="rounded-2xl border p-5"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <div className="mb-4">
          <h2 className="text-base font-bold">회원 탈퇴</h2>
        </div>
        <DeleteAccountForm />
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
      <section
        className="mb-5 rounded-2xl border p-5 sm:mb-8"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-base font-bold">{progress.label}</span>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            {summary.lp.toLocaleString()} LP
            {summary.overallRank ? ` · 전체 ${summary.overallRank}위` : ""}
          </span>
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded-full"
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
      </section>

      <section
        className="mb-5 rounded-2xl border p-5 sm:mb-8"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <h2 className="mb-3 text-base font-bold">출석체크</h2>
        <CheckInButton alreadyChecked={summary.checkedInToday} />
      </section>

      <section
        className="rounded-2xl border p-4 sm:p-5"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <h2 className="mb-3 text-base font-bold">최근 LP 변동</h2>
        {summary.recentLedger.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            아직 LP 변동 내역이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
            {summary.recentLedger.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span>{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                <span className="flex items-center gap-3">
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
