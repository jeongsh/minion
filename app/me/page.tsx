import { Bell, ChevronRight, Coins, FileText, MessageSquareText, Settings, ShieldBan, TrendingUp, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckInButton } from "@/components/rank/check-in-button";
import { RankAvatar } from "@/components/rank/rank-avatar";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";
import { TeamLogo } from "@/components/ui/team-logo";
import { formatRelativeOrDate } from "@/components/community/format";
import { getCurrentUser } from "@/lib/auth/current-user";
import { boardLabel } from "@/lib/community/boards";
import { blindLabel } from "@/lib/community/moderation-labels";
import { getCommentsByAuthor, getPostsByAuthor } from "@/lib/data/community";
import { getTeams } from "@/lib/data/lck";
import { getFavoriteTeamId } from "@/lib/fan/favorite-team";
import { tierProgress } from "@/lib/rank/config";
import { getRankSummary } from "@/lib/rank/queries";

export const metadata = { title: "마이 홈 · MINION" };

const REASON_LABELS: Record<string, string> = {
  attendance: "출석체크", post_created: "글 작성", comment_created: "댓글 작성",
  honor_received: "추천 받음", honor_removed: "추천 취소", dishonor_received: "비추천 받음",
  dishonor_removed: "비추천 취소", reported: "신고 제재", prediction_bet_placed: "승부예측 참가",
  prediction_bet_cancelled: "승부예측 취소", prediction_bet_won: "승부예측 적중", prediction_bet_refunded: "승부예측 환불",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function MePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  if (tab === "account") redirect("/me/settings#profile");
  if (tab === "blocks") redirect("/me/settings#blocks");

  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="layout-form py-16 text-center">
        <h1 className="home-section-title mb-3 text-2xl">마이 홈</h1>
        <p className="mb-6 text-sm text-[var(--ui-muted)]">내 랭크와 활동을 보려면 로그인이 필요합니다.</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/login?next=/me" className="flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-foreground)]">로그인</Link>
          <Link href="/signup" className="flex min-h-11 items-center justify-center rounded-lg border border-[var(--ui-border)] px-5 text-sm font-bold">회원가입</Link>
        </div>
      </main>
    );
  }

  const [summary, favoriteTeamId, teams, posts, comments] = await Promise.all([
    getRankSummary(user.id),
    getFavoriteTeamId(),
    getTeams(),
    getPostsByAuthor(user.id),
    getCommentsByAuthor(user.id),
  ]);
  const progress = tierProgress(summary.tier, summary.lp);
  const favoriteTeam = teams.find((team) => team.id === favoriteTeamId) ?? null;
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const activityHref = (postId: string, scope: "hub" | "team", teamId: string | null) => {
    const team = teamId ? teamsById.get(teamId) : null;
    return scope === "team" && team
      ? `/fan/${team.fanSiteHost || team.slug}/community/post/${postId}`
      : `/community/post/${postId}`;
  };
  const recentCommunityActivity = [
    ...posts.map((post) => ({
      id: `post:${post.id}`,
      kind: "post" as const,
      title: post.blindedAt ? blindLabel(post.blindedSource, "post") : post.title,
      context: boardLabel(post.siteScope, post.boardType),
      createdAt: post.createdAt,
      href: activityHref(post.id, post.siteScope, post.teamId),
    })),
    ...comments.map((comment) => ({
      id: `comment:${comment.id}`,
      kind: "comment" as const,
      title: comment.blindedAt ? blindLabel(comment.blindedSource, "comment") : comment.content,
      context: comment.postTitle,
      createdAt: comment.createdAt,
      href: activityHref(comment.postId, comment.postSiteScope, comment.postTeamId),
    })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5);
  const initials = (user.nickname ?? "MY").slice(0, 2).toUpperCase();

  return (
    <main className="layout-wide me-page max-w-5xl py-5 sm:py-8">
      <section className="me-card relative overflow-hidden rounded-3xl border p-5 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]" aria-hidden />
        <div className="flex items-start gap-4 sm:items-center sm:gap-5">
          <RankAvatar tier={summary.tier} src={user.profileImageUrl} alt="" fallback={initials} size="lg" />
          <div className="min-w-0 flex-1 pt-1 sm:pt-0">
            <p className="text-[13px] font-bold text-[var(--ui-muted)]">마이 홈</p>
            <h1 className="mt-0.5 truncate text-2xl font-black tracking-[-0.03em] text-[var(--ui-ink)] sm:text-3xl">{user.nickname ?? "MINION 팬"}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--ui-muted)]">
              <span className="font-bold text-[var(--ui-ink)]">{progress.label}</span>
              <span className="flex items-center gap-1"><Coins size={15} />{summary.lp.toLocaleString("ko-KR")} LP</span>
              {summary.overallRank ? <span>전체 {summary.overallRank.toLocaleString("ko-KR")}위</span> : null}
            </div>
          </div>
          <Link href="/me/settings" aria-label="설정" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-muted)] transition hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"><Settings size={19} /></Link>
        </div>
        {favoriteTeam ? (
          <div className="mt-5 flex items-center gap-2 border-t border-[var(--ui-border)] pt-4 text-[13px] text-[var(--ui-muted)]">
            <TeamLogo team={favoriteTeam} size="h-6 w-6" /><span>내 최애팀</span><span className="font-bold text-[var(--ui-ink)]">{favoriteTeam.name}</span>
          </div>
        ) : null}
      </section>

      <div className="mt-4 grid gap-4 sm:mt-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)] lg:gap-6">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <section className="me-card rounded-2xl border p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[13px] font-bold text-[var(--ui-muted)]">티어 진행도</p><h2 className="mt-1 text-lg font-black text-[var(--ui-ink)]">{progress.label}</h2></div>
              <span className="rounded-lg bg-[var(--ui-surface-muted)] px-2.5 py-1 text-[13px] font-bold text-[var(--ui-muted)]">{Math.round(progress.progressRatio * 100)}%</span>
            </div>
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[var(--ui-surface-muted)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.round(progress.progressRatio * 100)}%` }} /></div>
            <p className="mt-2 text-[13px] text-[var(--ui-muted)]">
              {progress.nextTier && progress.nextThreshold !== null ? `다음 티어(${progress.nextTierLabel})까지 ${(progress.nextThreshold - summary.lp).toLocaleString("ko-KR")} LP` : "최고 티어에 도달했어요."}
            </p>
          </section>

          <section className="me-card rounded-2xl border p-0">
            <div className="flex items-center justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
              <div><p className="text-[13px] font-bold text-[var(--ui-muted)]">커뮤니티</p><h2 className="mt-0.5 text-lg font-black text-[var(--ui-ink)]">내 활동</h2></div>
              <Link href={`/community/user/${user.id}`} className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-bold text-[var(--ui-muted)] transition hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]">전체보기<ChevronRight size={15} /></Link>
            </div>
            <div className="mx-5 grid grid-cols-2 overflow-hidden rounded-xl bg-[var(--ui-surface-muted)] sm:mx-6">
              <Link href={`/community/user/${user.id}?tab=posts`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[var(--ui-card-hover)]">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--ui-surface)] text-[var(--ui-muted)]"><FileText size={17} /></span>
                <span><span className="block text-[12px] font-medium text-[var(--ui-muted)]">내가 쓴 글</span><span className="block text-lg font-black tabular-nums text-[var(--ui-ink)]">{posts.length}</span></span>
              </Link>
              <Link href={`/community/user/${user.id}?tab=comments`} className="flex items-center gap-3 border-l border-[var(--ui-border)] px-4 py-3.5 transition hover:bg-[var(--ui-card-hover)]">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--ui-surface)] text-[var(--ui-muted)]"><MessageSquareText size={17} /></span>
                <span><span className="block text-[12px] font-medium text-[var(--ui-muted)]">내가 쓴 댓글</span><span className="block text-lg font-black tabular-nums text-[var(--ui-ink)]">{comments.length}</span></span>
              </Link>
            </div>
            {recentCommunityActivity.length > 0 ? (
              <ul className="mt-4 divide-y divide-[var(--ui-border)] border-t border-[var(--ui-border)] px-5 sm:px-6">
                {recentCommunityActivity.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="flex min-h-[62px] items-center gap-3 py-3 transition hover:opacity-75">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]">{item.kind === "post" ? <FileText size={15} /> : <MessageSquareText size={15} />}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-[var(--tp)]">{item.context}</span><span className="mt-0.5 block truncate text-sm font-semibold text-[var(--ui-ink)]">{item.title || "내용 없음"}</span></span>
                      <time dateTime={item.createdAt} className="shrink-0 text-[12px] font-medium text-[var(--ui-muted)]">{formatRelativeOrDate(item.createdAt)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 pb-5 pt-4 sm:px-6"><KitschEmptyState character="marker" title="아직 작성한 글이나 댓글이 없어요" body="커뮤니티에서 첫 이야기를 시작해 보세요." compact plain /></div>
            )}
          </section>

          <section className="me-card rounded-2xl border p-0">
            <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-6 sm:pt-6"><div><p className="text-[13px] font-bold text-[var(--ui-muted)]">최근 기록</p><h2 className="mt-0.5 text-lg font-black text-[var(--ui-ink)]">LP 변동</h2></div><TrendingUp size={20} className="text-[var(--ui-muted)]" /></div>
            {summary.recentLedger.length === 0 ? (
              <div className="px-5 pb-5 pt-3 sm:px-6"><KitschEmptyState character="flag" title="LP 로그가 아직 깨끗해요" body="출석체크나 예측에 참여하면 여기에 기록이 쌓여요." compact /></div>
            ) : (
              <ul className="me-ledger-list flex flex-col px-5 pb-4 sm:px-6 sm:pb-5">
                {summary.recentLedger.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                    <span className="flex items-center gap-3 whitespace-nowrap"><span className={`font-bold ${entry.delta >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{entry.delta >= 0 ? `+${entry.delta}` : entry.delta}</span><span className="text-[12px] text-[var(--ui-muted)]">{formatDate(entry.created_at)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 sm:space-y-6">
          <section className="me-card rounded-2xl border p-5 sm:p-6">
            <p className="text-[13px] font-bold text-[var(--ui-muted)]">오늘도 MINION</p>
            <h2 className="mt-1 text-lg font-black text-[var(--ui-ink)]">출석체크</h2>
            <p className="mb-4 mt-1 text-[13px] leading-5 text-[var(--ui-muted)]">매일 방문하고 LP를 차곡차곡 모아보세요.</p>
            <CheckInButton alreadyChecked={summary.checkedInToday} />
          </section>

          <section className="me-card rounded-2xl border p-3">
            <h2 className="px-2 pb-2 pt-1 text-[13px] font-bold text-[var(--ui-muted)]">내 설정 바로가기</h2>
            <QuickLink href={`/community/user/${user.id}`} icon={FileText} title="내 커뮤니티 활동" description="작성한 글과 댓글" />
            <QuickLink href="/me/settings#profile" icon={UserRound} title="프로필" description="닉네임과 프로필 이미지" />
            <QuickLink href="/me/settings#notifications" icon={Bell} title="알림" description="경기와 평가 알림" />
            <QuickLink href="/me/settings#blocks" icon={ShieldBan} title="차단 관리" description="차단한 사용자 관리" />
          </section>
        </aside>
      </div>
    </main>
  );
}

function QuickLink({ href, icon: Icon, title, description }: { href: string; icon: typeof Bell; title: string; description: string }) {
  return (
    <Link href={href} className="group flex min-h-[64px] items-center gap-3 rounded-xl px-2 transition hover:bg-[var(--ui-surface-muted)]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--ui-surface-muted)] text-[var(--ui-muted)] group-hover:text-[var(--ui-ink)]"><Icon size={17} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[var(--ui-ink)]">{title}</span><span className="block truncate text-[12px] text-[var(--ui-muted)]">{description}</span></span>
      <ChevronRight size={17} className="text-[var(--ui-muted)]" />
    </Link>
  );
}
