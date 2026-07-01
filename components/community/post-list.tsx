import Link from "next/link";

import { formatRelativeOrDate } from "@/components/community/format";
import { boardLabel, type BoardScope } from "@/lib/community/boards";
import { isHotPost } from "@/lib/community/hot";
import type { CommunityPostDetail } from "@/lib/community/types";

// 목록(리스트) 보기 — 시안 1b. 정확값 동기화 버전.
// 규칙: 중립/구조 색·치수는 시안 그대로(px/hex), 프라이머리(강조)만 accent 토큰 → 팀 컬러 자동 반영.
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
      <p className="rounded-[14px] border border-[#e4e8ef] bg-white p-8 text-center text-[13px] text-[#8a93a6]">
        아직 게시글이 없습니다. 첫 글을 작성해 보세요.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-[14px] border border-[#e4e8ef] bg-white shadow-[0_6px_24px_-12px_rgba(20,30,60,0.18),0_1px_2px_rgba(20,30,60,0.04)]">
      {posts.map((post) => (
        <li key={post.id} className="border-b border-[#f2f4f8] last:border-b-0">
          <Link
            href={detailHref(post.id)}
            className="grid grid-cols-[88px_1fr] items-center gap-[14px] px-6 py-[14px] transition-colors hover:bg-[#f7f9fc]"
          >
            <div className="h-[62px] w-[88px] overflow-hidden rounded-[9px] bg-[#eef2f7]">
              {post.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2">
                  <p className="line-clamp-3 text-center text-[11px] leading-tight text-[#aab2c2]">
                    {post.excerpt || "내용 없음"}
                  </p>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="mb-[6px] flex items-center gap-[5px]">
                <span className="rounded-[5px] bg-[#f1f4f9] px-[7px] py-1 text-[10px] font-bold text-[#56607a]">
                  {boardLabel(scope, post.boardType)}
                </span>
                {isHotPost(post) && (
                  <span className="rounded-[5px] bg-accent px-[7px] py-1 text-[10px] font-bold text-accent-foreground">
                    인기
                  </span>
                )}
              </div>
              <h3 className="truncate text-[14.5px] font-bold leading-[1.35] text-[#151b2b]">
                {post.title}
              </h3>
              <div className="mt-[6px] flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-[#8a93a6]">
                <span>{formatRelativeOrDate(post.createdAt)}</span>
                <span aria-hidden>·</span>
                <span>명예 {post.likeCount}</span>
                <span aria-hidden>·</span>
                <span>댓글 {post.commentCount}</span>
                <span aria-hidden>·</span>
                <span>조회 {post.viewCount}</span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
