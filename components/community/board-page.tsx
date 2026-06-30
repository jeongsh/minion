import Link from "next/link";

import { SectionHeader } from "@/components/layout/section-header";
import { PostList } from "@/components/community/post-list";
import type { BoardScope } from "@/lib/community/boards";
import { getBoardPosts } from "@/lib/data/community";

// 보드별 글 목록 페이지(허브/팀 공용). board 설정 기반 제네릭.
export async function BoardPage({
  scope,
  boardSlug,
  boardLabel,
  eyebrow,
  teamId,
  teamSlug,
}: {
  scope: BoardScope;
  boardSlug: string;
  boardLabel: string;
  eyebrow: string;
  teamId?: string | null;
  teamSlug?: string;
}) {
  const posts = await getBoardPosts({ scope, boardType: boardSlug, teamId });

  const basePath =
    scope === "team" && teamSlug
      ? `/fan/${teamSlug}/community/${boardSlug}`
      : `/community/${boardSlug}`;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader eyebrow={eyebrow} title={boardLabel} />
        <Link
          href={`${basePath}/new`}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
        >
          글쓰기
        </Link>
      </div>
      <PostList posts={posts} scope={scope} teamSlug={teamSlug} />
    </main>
  );
}
