import { CommunityFeed } from "@/components/community/community-feed";
import { CommunityContentLayout } from "@/components/community/community-content-layout";
import { CommunityDirectoryNav } from "@/components/community/community-directory-nav";
import { CelebrationBanner } from "@/components/domain/celebration-banner";
import type { BoardScope } from "@/lib/community/boards";
import { getCalendarEvents, getTodayCelebrations } from "@/lib/calendar/events";
import { getBoardPostPage } from "@/lib/data/community";
import { getTeamsSortedByRank } from "@/lib/data/lck";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getFavoriteTeamId } from "@/lib/fan/favorite-team";
import { getFollowedTeamIds } from "@/lib/fan/followed-teams";

// 커뮤니티 목록 — 핸드오프 2c. 말머리 필터 + 게시글 테이블.
export async function CommunityFeedPage({
  scope,
  title,
  teamId,
  teamSlug,
  page = 1,
  category,
  search,
  hotOnly = false,
}: {
  scope: BoardScope;
  eyebrow?: string;
  title?: string;
  teamId?: string | null;
  teamSlug?: string;
  page?: number;
  category?: string | null;
  search?: string | null;
  hotOnly?: boolean;
}) {
  // 팀 게시판에서만 오늘의 기념일을 띄운다(허브는 팀 특정이 안 됨).
  const [postPage, todayCelebrations, viewer, teams, favoriteTeamId, followedTeamIds] = await Promise.all([
    getBoardPostPage({ scope, teamId, page, boardType: category, search, hotOnly }),
    scope === "team" && teamId
      ? getCalendarEvents({ teamId }).then(getTodayCelebrations)
      : Promise.resolve([]),
    getCurrentUser(),
    getTeamsSortedByRank(),
    getFavoriteTeamId(),
    getFollowedTeamIds(),
  ]);
  const communityTeams = teams.filter(
    (team) => team.isLckTeam !== false && team.isActive !== false && Boolean(team.fanSiteHost),
  );

  const newPath =
    scope === "team" && teamSlug ? `/fan/${teamSlug}/community/new` : `/community/new`;

  if (scope === "team") {
    return (
      <main className="community-neutral fan-page-container flex flex-col gap-5 pb-7 pt-0 md:py-9" style={{ ["--tp" as string]: "var(--team-primary, #6158ff)" }}>
        <h1 className="sr-only">{title ?? "커뮤니티"}</h1>
        <CelebrationBanner events={todayCelebrations} action="write" />
        <CommunityContentLayout posts={postPage.popularPosts} scope={scope} teamSlug={teamSlug}>
          <div className="flex min-w-0 flex-col gap-4">
            <CommunityDirectoryNav favoriteTeamId={favoriteTeamId} followedTeamIds={followedTeamIds} scope={scope} teamSlug={teamSlug} teams={communityTeams} />
            <CommunityFeed key={`${category ?? "all"}:${search ?? ""}:${hotOnly}:${postPage.page}`} postPage={postPage} scope={scope} teamSlug={teamSlug} newPath={newPath} viewerId={viewer?.id} activeCategory={category} searchQuery={search} hotOnly={hotOnly} />
          </div>
        </CommunityContentLayout>
      </main>
    );
  }

  return (
    <main className="subpage community-neutral min-h-screen">
      <div className="layout-wide flex flex-col gap-5 pb-6 sm:py-8">
        <h1 className="sr-only">{title ?? "커뮤니티"}</h1>
        <CommunityContentLayout posts={postPage.popularPosts} scope={scope} teamSlug={teamSlug}>
          <div className="flex min-w-0 flex-col gap-4">
            <CommunityDirectoryNav favoriteTeamId={favoriteTeamId} followedTeamIds={followedTeamIds} scope={scope} teamSlug={teamSlug} teams={communityTeams} />
            <CommunityFeed key={`${category ?? "all"}:${search ?? ""}:${hotOnly}:${postPage.page}`} postPage={postPage} scope={scope} teamSlug={teamSlug} newPath={newPath} viewerId={viewer?.id} activeCategory={category} searchQuery={search} hotOnly={hotOnly} />
          </div>
        </CommunityContentLayout>
      </div>
    </main>
  );
}
