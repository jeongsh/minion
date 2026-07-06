import { CommunityFeed } from "@/components/community/community-feed";
import { PageHeader } from "@/components/ui/page-header";
import type { BoardScope } from "@/lib/community/boards";
import { getBoardPosts } from "@/lib/data/community";

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
  const posts = await getBoardPosts({ scope, teamId });

  const newPath =
    scope === "team" && teamSlug ? `/fan/${teamSlug}/community/new` : `/community/new`;

  if (scope === "team") {
    return (
      <main className="community-neutral fan-page-container flex flex-col gap-5 py-7 md:py-9" style={{ ["--tp" as string]: "var(--team-primary, #6158ff)" }}>
        <PageHeader eyebrow={eyebrow ?? "COMMUNITY"} title={title ?? "커뮤니티"} />
        <CommunityFeed posts={posts} scope={scope} teamSlug={teamSlug} newPath={newPath} />
      </main>
    );
  }

  return (
    <main className="subpage community-neutral min-h-screen !bg-[var(--ui-surface)]">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-10 py-8 max-md:px-5">
        <PageHeader eyebrow={eyebrow ?? "COMMUNITY"} title={title ?? "커뮤니티"} />
        <CommunityFeed posts={posts} scope={scope} teamSlug={teamSlug} newPath={newPath} />
      </div>
    </main>
  );
}
