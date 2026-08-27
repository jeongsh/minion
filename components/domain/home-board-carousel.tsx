import Link from "next/link";
import { Eye, MessageCircle, ThumbsUp } from "lucide-react";
import { formatRelativeOrDate } from "@/components/community/format";
import type { CommunityPostDetail } from "@/lib/community/types";
import { boardLabel } from "@/lib/community/boards";
import { isHotPost } from "@/lib/community/hot";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";

export function HomeBoardCarousel({
  posts,
  scope = "hub",
  teamSlug,
}: {
  posts: CommunityPostDetail[];
  scope?: "hub" | "team";
  teamSlug?: string;
}) {
  const detailHref = (postId: string) =>
    scope === "team" && teamSlug
      ? `/fan/${teamSlug}/community/post/${postId}`
      : `/community/post/${postId}`;

  if (posts.length === 0) {
    return (
      <KitschEmptyState
        character="megapon"
        title="인기글 충전 중"
        body="화력 좋은 글이 생기면 바로 모아둘게요."
        compact
      />
    );
  }

  return (
    <ul className="grid gap-0 bg-transparent p-0 sm:gap-3 sm:rounded-2xl sm:bg-[var(--ui-card-bg)] sm:p-3 md:grid-cols-2">
      {posts.slice(0, 6).map((post) => (
        <li
          key={post.id}
          className="overflow-hidden border-b border-[var(--ui-card-divider)] bg-transparent last:border-b-0 sm:rounded-xl sm:border-b-0 sm:bg-[var(--ui-surface)]"
        >
          <Link
            href={detailHref(post.id)}
            className="group grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 px-0 py-2 transition-colors hover:bg-[var(--ui-card-hover)] min-[390px]:min-h-[65px] min-[390px]:gap-3 sm:min-h-[82px] sm:px-5 sm:py-3"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-[13px] font-medium text-[var(--tp,var(--accent))]">
                  {boardLabel(scope, post.boardType)}
                </span>
                {isHotPost(post) ? (
                  <span
                    className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--tp,var(--accent))_12%,transparent)] px-1.5 py-0.5 text-[13px] font-medium leading-none text-[var(--tp,var(--accent))]"
                  >
                    인기
                  </span>
                ) : null}
                <h3 className="min-w-0 truncate text-[14px] font-medium text-[var(--ui-ink)] sm:text-base">
                  {post.title}
                </h3>
              </div>

              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[13px] font-normal text-[var(--ui-muted)] min-[390px]:gap-2 sm:mt-1 sm:gap-2.5">
                <span className="max-w-28 truncate font-medium text-[var(--ui-text)]">
                  {post.authorName ?? "작성자 없음"}
                </span>
                <span className="shrink-0">{formatRelativeOrDate(post.createdAt)}</span>
                <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
                  <Eye size={13} strokeWidth={1.8} aria-hidden />
                  {post.viewCount.toLocaleString("ko-KR")}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <MessageCircle size={11} strokeWidth={1.8} className="sm:h-[13px] sm:w-[13px]" aria-hidden />
                  {post.commentCount.toLocaleString("ko-KR")}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <ThumbsUp size={11} strokeWidth={1.8} className="sm:h-[13px] sm:w-[13px]" aria-hidden />
                  {post.likeCount.toLocaleString("ko-KR")}
                </span>
              </div>
            </div>

            {post.thumbnailUrl ? (
              <span className="h-[51px] w-[68px] shrink-0 overflow-hidden rounded-md bg-[var(--ui-surface-muted)] min-[390px]:h-[57px] min-[390px]:w-[76px] min-[390px]:rounded-lg sm:h-[58px] sm:w-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
