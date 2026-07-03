import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CommunityFeed } from "@/components/community/community-feed";
import type { BoardScope } from "@/lib/community/boards";
import { getBoardPosts } from "@/lib/data/community";

// 커뮤니티 목록 — 핸드오프 2c. 말머리 필터 + 게시글 테이블.
export async function CommunityFeedPage({
  scope,
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
        <Breadcrumb
          items={[
            { label: title ?? "팬페이지", href: teamSlug ? `/fan/${teamSlug}` : undefined },
            { label: "커뮤니티" },
          ]}
        />
        <CommunityFeed posts={posts} scope={scope} teamSlug={teamSlug} newPath={newPath} />
      </main>
    );
  }

  return (
    <main className="subpage min-h-screen">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-10 py-8 max-md:px-5">
        <Breadcrumb items={[{ label: "홈", href: "/" }, { label: "커뮤니티" }]} />
        <CommunityFeed posts={posts} scope={scope} teamSlug={teamSlug} newPath={newPath} />
      </div>
    </main>
  );
}
