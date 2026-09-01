import { Eye, FileText, MessageCircle, MessageSquareText, ThumbsUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuthorMenu } from "@/components/community/author-menu";
import { formatRelativeOrDate } from "@/components/community/format";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { boardLabel } from "@/lib/community/boards";
import { blindLabel } from "@/lib/community/moderation-labels";
import {
  getCommentsByAuthorCount,
  getCommentsByAuthorPage,
  getPostsByAuthorCount,
  getPostsByAuthorPage,
} from "@/lib/data/community";
import {
  getBlockedCommunityUserIds,
  getCommunityUserSummary,
} from "@/lib/data/community-users";
import { getTeamById } from "@/lib/data/lck";
import { TIER_LABELS } from "@/lib/rank/config";

type ActivityTab = "posts" | "comments";

// 커뮤니티 사용자 활동 페이지. 얇은 목록형이라 색인 제외.
export const metadata: Metadata = { title: "사용자 활동", robots: { index: false } };

export default async function CommunityUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const [{ userId }, query, viewer] = await Promise.all([params, searchParams, getCurrentUser()]);
  const tab: ActivityTab = query.tab === "comments" ? "comments" : "posts";
  const requestedPage = Math.min(10_000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const blockedIds = viewer ? await getBlockedCommunityUserIds(viewer.id) : new Set<string>();
  if (blockedIds.has(userId)) notFound();

  const profilePromise = getCommunityUserSummary(userId);
  const [profile, postsPage, commentsPage] = tab === "posts"
    ? await Promise.all([
      profilePromise,
      getPostsByAuthorPage(userId, requestedPage),
      getCommentsByAuthorCount(userId).then((totalCount) => ({ items: [], page: 1, totalPages: 1, totalCount })),
    ])
    : await Promise.all([
      profilePromise,
      getPostsByAuthorCount(userId).then((totalCount) => ({ items: [], page: 1, totalPages: 1, totalCount })),
      getCommentsByAuthorPage(userId, requestedPage),
    ]);
  if (!profile) notFound();
  const posts = postsPage.items;
  const comments = commentsPage.items;
  const activePage = tab === "posts" ? postsPage : commentsPage;

  const teamIds = [...new Set([
    ...posts.flatMap((post) => post.teamId ? [post.teamId] : []),
    ...comments.flatMap((comment) => comment.postTeamId ? [comment.postTeamId] : []),
    ...(profile.favoriteTeamId ? [profile.favoriteTeamId] : []),
  ])];
  const teams = new Map(
    (await Promise.all(teamIds.map((id) => getTeamById(id))))
      .filter((team) => Boolean(team))
      .map((team) => [team!.id, team!]),
  );
  const favoriteTeam = profile.favoriteTeamId ? teams.get(profile.favoriteTeamId) ?? null : null;
  const postHref = (postId: string, scope: "hub" | "team", teamId: string | null) => {
    if (scope === "team" && teamId) {
      const team = teams.get(teamId);
      if (team) return `/fan/${team.fanSiteHost || team.slug}/community/post/${postId}`;
    }
    return `/community/post/${postId}`;
  };

  return (
    <main className="subpage min-h-screen">
      <div className="layout-wide py-6 sm:py-8">
        <div className="content-reading mx-auto flex flex-col gap-5">
          <PageHeader
            title="사용자 활동"
            breadcrumbs={[{ label: "커뮤니티", href: "/community" }, { label: profile.nickname }]}
          />

          <section className="mobile-full-bleed relative rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-5 sm:px-6 sm:py-6">
            <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-[var(--ui-muted)]">Community profile</p>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <AuthorMenu
                authorId={profile.id}
                authorName={profile.nickname}
                authorImageUrl={profile.profileImageUrl}
                authorTier={profile.tier}
                authorTeam={favoriteTeam}
                viewerId={viewer?.id}
                variant="profile"
              />
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[var(--ui-muted)] sm:justify-end">
                <span className="rounded-full bg-[var(--ui-surface-muted)] px-3 py-1.5 text-[var(--ui-text)]">{TIER_LABELS[profile.tier]}</span>
                <span>{new Date(profile.createdAt).toLocaleDateString("ko-KR")} 가입</span>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)]">
              <ProfileStat label="작성글" value={postsPage.totalCount} />
              <ProfileStat label="작성 댓글" value={commentsPage.totalCount} bordered />
            </dl>
          </section>

          <section className="mobile-full-bleed overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)]">
            <nav className="grid grid-cols-2 gap-1 bg-[var(--ui-surface-muted)] p-1.5" aria-label="사용자 활동">
              <TabLink href={`/community/user/${userId}?tab=posts`} active={tab === "posts"} icon={<FileText size={16} />} label="작성글" count={postsPage.totalCount} />
              <TabLink href={`/community/user/${userId}?tab=comments`} active={tab === "comments"} icon={<MessageSquareText size={16} />} label="작성 댓글" count={commentsPage.totalCount} />
            </nav>

            <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3.5 sm:px-5">
              <h2 className="font-paperozi text-[17px] text-[var(--ui-ink)]">{tab === "posts" ? "작성글" : "작성 댓글"}</h2>
              <span className="text-[13px] font-semibold text-[var(--ui-muted)]">최신순</span>
            </div>

            {tab === "posts" ? (
              posts.length > 0 ? (
                <ul className="divide-y divide-[var(--ui-border)]">
                  {posts.map((post) => (
                    <li key={post.id}>
                      <Link href={postHref(post.id, post.siteScope, post.teamId)} className="block px-4 py-4 transition-colors hover:bg-[var(--ui-surface-muted)] sm:px-5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-[12px] font-medium text-[var(--tp)]">{boardLabel(post.siteScope, post.boardType)}</span>
                          <h3 className={`truncate text-[15px] font-bold ${post.blindedAt ? "text-[var(--ui-muted)]" : "text-[var(--ui-ink)]"}`}>
                            {post.blindedAt ? blindLabel(post.blindedSource, "post") : post.title}
                          </h3>
                        </div>
                        <p className="mt-2 flex flex-wrap items-center gap-3 text-[12px] font-medium text-[var(--ui-muted)]">
                          <span>{formatRelativeOrDate(post.createdAt)}</span>
                          <span className="inline-flex items-center gap-1"><Eye size={13} />{post.viewCount}</span>
                          <span className="inline-flex items-center gap-1"><MessageCircle size={13} />{post.commentCount}</span>
                          <span className="inline-flex items-center gap-1"><ThumbsUp size={13} />{post.likeCount}</span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <EmptyActivity title="공개된 작성글이 없습니다" />
            ) : comments.length > 0 ? (
              <ul className="divide-y divide-[var(--ui-border)]">
                {comments.map((comment) => (
                  <li key={comment.id}>
                    <Link href={postHref(comment.postId, comment.postSiteScope, comment.postTeamId)} className="block px-4 py-4 transition-colors hover:bg-[var(--ui-surface-muted)] sm:px-5">
                      <p className="truncate text-[12px] font-medium text-[var(--tp)]">{comment.postTitle}</p>
                      <p className={`mt-1.5 line-clamp-2 whitespace-pre-wrap text-[15px] leading-6 ${comment.blindedAt ? "text-[var(--ui-muted)]" : "text-[var(--ui-text)]"}`}>
                        {comment.blindedAt ? blindLabel(comment.blindedSource, "comment") : comment.content}
                      </p>
                      <p className="mt-2 text-[12px] font-medium text-[var(--ui-muted)]">{formatRelativeOrDate(comment.createdAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <EmptyActivity title="공개된 작성 댓글이 없습니다" />}

            {activePage.totalPages > 1 ? (
              <Pagination
                page={activePage.page}
                totalPages={activePage.totalPages}
                getHref={(page) => `/community/user/${userId}?tab=${tab}&page=${page}`}
                className="border-t border-[var(--ui-border)] px-4 py-4"
              />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function ProfileStat({ label, value, bordered = false }: { label: string; value: number; bordered?: boolean }) {
  return (
    <div className={`px-4 py-3.5 text-center ${bordered ? "border-l border-[var(--ui-border)]" : ""}`}>
      <dt className="text-[12px] font-medium text-[var(--ui-muted)]">{label}</dt>
      <dd className="mt-0.5 text-xl font-black tabular-nums text-[var(--ui-ink)]">{value}</dd>
    </div>
  );
}

function TabLink({ href, active, icon, label, count }: { href: string; active: boolean; icon: React.ReactNode; label: string; count: number }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition ${active ? "bg-[var(--ui-surface)] text-[var(--ui-ink)] shadow-[0_1px_0_rgb(24_25_28_/_0.06)]" : "text-[var(--ui-muted)] hover:text-[var(--ui-text)]"}`}>
      {icon}<span>{label}</span><span className="text-[12px] tabular-nums opacity-70">{count}</span>
    </Link>
  );
}

function EmptyActivity({ title }: { title: string }) {
  return (
    <div className="px-4 py-8">
      <KitschEmptyState character="marker" title={title} compact plain />
    </div>
  );
}
