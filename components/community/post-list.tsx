import Link from "next/link";

import { formatRelativeOrDate } from "@/components/community/format";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import type { CommunityPostDetail } from "@/lib/community/types";

// 목록(리스트) 보기 — 시안 1b. 왼쪽 썸네일 + 말머리/통계 위계.
// 색상은 토큰(accent/surface/border/muted)만 사용 → 팀 프라이머리(--accent)를 그대로 따른다.
export function PostList({
  posts,
  scope,
  teamSlug,
}: {
  posts: CommunityPostDetail[];
  scope: BoardScope;
  teamSlug?: string;
}) {
  const detailHref = (postId: string) =>
    scope === "team" && teamSlug
      ? `/fan/${teamSlug}/community/post/${postId}`
      : `/community/post/${postId}`;

  if (posts.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
        아직 게시글이 없습니다. 첫 글을 작성해 보세요.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-lg border border-border bg-surface">
      {posts.map((post) => (
        <li key={post.id} className="border-b border-border last:border-b-0">
          <Link
            href={detailHref(post.id)}
            className="grid grid-cols-[84px_1fr] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-muted sm:px-5"
          >
            <div className="aspect-[7/5] w-[84px] overflow-hidden rounded-lg bg-surface-muted">
              {post.thumbnailUrl ? (
                // 외부/스토리지 URL 혼재 → next/image 대신 일반 img 사용.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2">
                  <p className="line-clamp-3 text-center text-[11px] leading-tight text-muted">
                    {post.excerpt || "내용 없음"}
                  </p>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="rounded bg-surface-muted px-2 py-1 text-[11px] font-semibold text-muted">
                  {boardLabel(scope, post.boardType)}
                </span>
              </div>
              <h3 className="truncate text-[15px] font-bold text-foreground">{post.title}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span className="font-semibold text-accent">명예 {post.likeCount}</span>
                <span aria-hidden>·</span>
                <span>댓글 {post.commentCount}</span>
                <span aria-hidden>·</span>
                <span>조회 {post.viewCount}</span>
                <span aria-hidden>·</span>
                <span>{formatRelativeOrDate(post.createdAt)}</span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
