import Link from "next/link";
import type { ReactNode } from "react";

import { AdSlot } from "@/components/ui/ad-slot";
import type { BoardScope } from "@/lib/community/boards";
import { hotScore } from "@/lib/community/hot";
import type { CommunityPostDetail } from "@/lib/community/types";

export function CommunityContentLayout({ children, posts, scope, teamSlug, currentPostId }: { children: ReactNode; posts: CommunityPostDetail[]; scope: BoardScope; teamSlug?: string; currentPostId?: string }) {
  const popular = [...posts]
    .filter((post) => post.id !== currentPostId)
    .sort((a, b) => hotScore(b) - hotScore(a) || b.viewCount - a.viewCount || b.commentCount - a.commentCount)
    .slice(0, 5);
  const href = (postId: string) => scope === "team" && teamSlug
    ? `/fan/${teamSlug}/community/post/${postId}`
    : `/community/post/${postId}`;

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
      <div className="min-w-0">{children}</div>
      <aside className="mx-auto flex w-full max-w-[300px] flex-col gap-4 xl:sticky xl:top-[88px]" aria-label="커뮤니티 보조 정보">
        <section className="overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)]">
          <h2 className="border-b border-[var(--ui-border)] px-4 py-3.5 text-[16px] font-bold text-[var(--ui-ink)]">인기글</h2>
          {popular.length > 0 ? (
            <ol className="divide-y divide-[var(--ui-border)] px-4">
              {popular.map((post, index) => (
                <li key={post.id}>
                  <Link href={href(post.id)} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 py-3 text-[14px] hover:text-[var(--tp)]">
                    <span className="font-bold tabular-nums text-[var(--tp)]">{index + 1}</span>
                    <span className="truncate font-medium text-[var(--ui-text)]">{post.title}</span>
                    <span className="text-[12px] tabular-nums text-[var(--ui-muted)]">{post.commentCount}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : <p className="px-4 py-8 text-center text-[12px] text-[var(--ui-muted)]">표시할 게시글이 없습니다.</p>}
        </section>
        <AdSlot className="h-[250px] w-full" />
      </aside>
    </div>
  );
}
