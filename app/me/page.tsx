import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getRankSummary } from "@/lib/rank/queries";
import { tierProgress } from "@/lib/rank/config";
import { RankBadge } from "@/components/rank/rank-badge";
import { CheckInButton } from "@/components/rank/check-in-button";
import { LogoutButton } from "@/components/auth/logout-button";

export const metadata = {
  title: "내 랭크 · MINION",
};

// LP 변동 사유 한글 라벨.
const REASON_LABELS: Record<string, string> = {
  attendance: "출석체크",
  post_created: "글 작성",
  comment_created: "댓글 작성",
  honor_received: "명예 받음",
  honor_removed: "명예 취소",
  dishonor_received: "비추 받음",
  reported: "신고 제재",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center sm:px-6">
        <h1 className="mb-3 text-2xl font-black">내 랭크</h1>
        <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
          랭크와 LP를 보려면 로그인이 필요해요.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md px-4 py-2 text-sm font-bold text-[var(--accent-foreground)]"
            style={{ backgroundColor: "var(--accent)" }}
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="rounded-md border px-4 py-2 text-sm font-bold"
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
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black">{user.nickname ?? "내 프로필"}</h1>
          <RankBadge tier={summary.tier} size="md" />
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/me/profile"
            className="rounded-md border px-3 py-1.5 text-sm font-semibold"
            style={{ borderColor: "var(--border)" }}
          >
            프로필 관리
          </Link>
          <LogoutButton />
        </div>
      </header>

      {/* 티어 / LP / 진행도 */}
      <section
        className="mb-8 rounded-lg border p-5"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-lg font-bold">{progress.label}</span>
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            {summary.lp} LP
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
            : "최고 티어에 도달했어요!"}
        </p>
      </section>

      {/* 출석체크 */}
      <section
        className="mb-8 rounded-lg border p-5"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <h2 className="mb-3 text-base font-bold">출석체크</h2>
        <CheckInButton alreadyChecked={summary.checkedInToday} />
      </section>

      {/* 최근 LP 변동 */}
      <section
        className="rounded-lg border p-5"
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
    </main>
  );
}
