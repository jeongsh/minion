import { CommunityFeed } from "@/components/community/community-feed";
import { CommunityContentLayout } from "@/components/community/community-content-layout";
import { CelebrationBanner } from "@/components/domain/celebration-banner";
import { PageHeader } from "@/components/ui/page-header";
import type { BoardScope } from "@/lib/community/boards";
import { getCalendarEvents, getTodayCelebrations } from "@/lib/calendar/events";
import { getBoardPosts } from "@/lib/data/community";
import { getCurrentUser } from "@/lib/auth/current-user";

// 커뮤니티 목록 — 핸드오프 2c. 말머리 필터 + 게시글 테이블.
export async function CommunityFeedPage({
  scope,
  eyebrow,
  title,
  teamId,
  teamSlug,
}: {
  scope: BoardScope;
  eyebrow?: string;
  title?: string;
  teamId?: string | null;
  teamSlug?: string;
}) {
  // 팀 게시판에서만 오늘의 기념일을 띄운다(허브는 팀 특정이 안 됨).
  const [posts, todayCelebrations, viewer] = await Promise.all([
    getBoardPosts({ scope, teamId }),
    scope === "team" && teamId
      ? getCalendarEvents({ teamId }).then(getTodayCelebrations)
      : Promise.resolve([]),
    getCurrentUser(),
  ]);

  const newPath =
    scope === "team" && teamSlug ? `/fan/${teamSlug}/community/new` : `/community/new`;

  if (scope === "team") {
    return (
      <main className="community-neutral fan-page-container flex flex-col gap-5 py-7 md:py-9" style={{ ["--tp" as string]: "var(--team-primary, #6158ff)" }}>
        <PageHeader
          eyebrow={eyebrow ?? "COMMUNITY"}
          title={title ?? "커뮤니티"}
          breadcrumbs={teamSlug ? [{ label: "팀 홈", href: `/fan/${teamSlug}` }, { label: title ?? "커뮤니티" }] : undefined}
        />
        <CelebrationBanner events={todayCelebrations} action="write" />
        <CommunityContentLayout posts={posts} scope={scope} teamSlug={teamSlug}>
          <CommunityFeed posts={posts} scope={scope} teamSlug={teamSlug} newPath={newPath} viewerId={viewer?.id} />
        </CommunityContentLayout>
      </main>
    );
  }

  return (
    <main className="subpage community-neutral min-h-screen">
      <div className="layout-wide flex flex-col gap-5 py-6 sm:py-8">
        <PageHeader eyebrow={eyebrow ?? "COMMUNITY"} title={title ?? "커뮤니티"} />
        <CommunityContentLayout posts={posts} scope={scope} teamSlug={teamSlug}>
          <CommunityFeed posts={posts} scope={scope} teamSlug={teamSlug} newPath={newPath} viewerId={viewer?.id} />
        </CommunityContentLayout>
      </div>
    </main>
  );
}
