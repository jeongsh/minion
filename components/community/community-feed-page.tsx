import Link from "next/link";

import { CommunityFeed } from "@/components/community/community-feed";
import { SectionHeader } from "@/components/layout/section-header";
import type { BoardScope } from "@/lib/community/boards";
import { getBoardPosts } from "@/lib/data/community";

// 커뮤니티 피드 페이지 — 시안 1b 헤더. 글쓰기 버튼을 프라이머리(accent)로.
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
    scope === "team" && teamSlug ? `/fan/${teamSlug}/community/new` : `/community/new`;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader eyebrow={eyebrow} title={title} />
        <Link
          href={newPath}
          className="inline-flex items-center gap-[7px] rounded-[9px] bg-accent px-[18px] py-3 text-[14px] font-bold text-accent-foreground shadow-[0_6px_16px_-6px] shadow-accent/60 transition-opacity hover:opacity-90"
        >
          ＋ 글쓰기
        </Link>
      </div>
      <CommunityFeed posts={posts} scope={scope} teamSlug={teamSlug} />
    </main>
  );
}
