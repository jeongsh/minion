import Link from "next/link";

import { CommunityFeed } from "@/components/community/community-feed";
import { SectionHeader } from "@/components/layout/section-header";
import type { BoardScope } from "@/lib/community/boards";
import { getBoardPosts } from "@/lib/data/community";

// 단일 피드 페이지(허브/팀 공용). 전체 말머리 글을 한 번에 보여주고
// 필터/보기 토글은 CommunityFeed(클라이언트)가 처리한다.
export async function CommunityFeedPage({
  scope,
  eyebrow,
  title,
  teamId,
  teamSlug,
}: {
  scope: BoardScope;
  eyebrow: string;
  title: string;
  teamId?: string | null;
  teamSlug?: string;
}) {
  const posts = await getBoardPosts({ scope, teamId });

  const newPath =
    scope === "team" && teamSlug
      ? `/fan/${teamSlug}/community/new`
      : `/community/new`;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader eyebrow={eyebrow} title={title} />
        <Link
          href={newPath}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
        >
          글쓰기
        </Link>
      </div>
      <CommunityFeed posts={posts} scope={scope} teamSlug={teamSlug} />
    </main>
  );
}
