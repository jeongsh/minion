import Link from "next/link";

import { formatRelativeOrDate } from "@/components/community/format";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import { isHotPost } from "@/lib/community/hot";
import type { CommunityPostDetail } from "@/lib/community/types";

// 갤러리(카드 그리드) 보기. 본문 첫 이미지를 썸네일로 사용.
// 이미지 없는 글은 텍스트 카드(썸네일 영역에 제목/요약)로 대체.
export function PostGallery({
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
      <p className="rounded-md border border-border bg-surface p-8 text-center text-sm text-muted">
        아직 게시글이 없습니다. 첫 글을 작성해 보세요.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            href={detailHref(post.id)}
            className="group flex flex-col overflow-hidden rounded-md border border-border bg-surface transition-colors hover:bg-surface-muted"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
              {post.thumbnailUrl ? (
                // 외부/스토리지 URL 혼재 → next/image 대신 일반 img 사용.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-3">
                  <p className="line-clamp-4 text-xs text-muted">{post.excerpt || "내용 없음"}</p>
                </div>
              )}
              <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white">
                {boardLabel(scope, post.boardType)}
              </span>
              {isHotPost(post) && (
                <span className="absolute right-2 top-2 rounded bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-foreground">
                  인기
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 p-2.5">
              <h3 className="line-clamp-2 text-sm font-medium">{post.title}</h3>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>{formatRelativeOrDate(post.createdAt)}</span>
                <span>· 명예 {post.likeCount}</span>
                <span>· 댓글 {post.commentCount}</span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
