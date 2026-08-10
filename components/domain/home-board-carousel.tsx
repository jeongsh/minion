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

  const isHomeLatest = scope === "hub";

  return (
    <ul
      className={
        isHomeLatest
          ? "grid gap-3 rounded-2xl bg-[var(--home-card-bg-alt)] p-3 sm:p-4 md:grid-cols-2"
          : "grid overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] md:grid-cols-2 md:[&>li:nth-child(odd)]:border-r md:[&>li:nth-last-child(-n+2)]:border-b-0 [&>li:last-child]:border-b-0"
      }
    >
      {posts.slice(0, 6).map((post) => (
        <li
          key={post.id}
          className={
            isHomeLatest
              ? "overflow-hidden rounded-xl bg-[var(--ui-surface)]"
              : "border-b border-[var(--ui-border)]"
          }
        >
          <Link
            href={detailHref(post.id)}
            className={`group grid min-h-[82px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors sm:px-5 ${
              isHomeLatest
                ? "hover:bg-[var(--home-card-bg-hover)]"
                : "hover:bg-[var(--ui-surface-muted)]"
            }`}
          >
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-[13px] font-semibold text-[var(--tp,var(--accent))]">
                  {boardLabel(scope, post.boardType)}
                </span>
                {isHotPost(post) ? (
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[12px] font-medium leading-none text-[var(--tp,var(--accent))] ${
                      isHomeLatest
                        ? "bg-[color-mix(in_srgb,var(--tp,var(--accent))_12%,transparent)]"
                        : "border border-[var(--tp,var(--accent))]"
                    }`}
                  >
                    인기
                  </span>
                ) : null}
                <h3 className="min-w-0 truncate text-[15px] font-semibold text-[var(--ui-ink)] sm:text-base">
                  {post.title}
                </h3>
              </div>

              <div className="mt-1 flex min-w-0 items-center gap-2.5 overflow-hidden whitespace-nowrap text-[13px] font-normal text-[var(--ui-muted)]">
                <span className="max-w-28 truncate font-medium text-[var(--ui-text)]">
                  {post.authorName ?? "작성자 없음"}
                </span>
                <span className="shrink-0">{formatRelativeOrDate(post.createdAt)}</span>
                <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
                  <Eye size={13} strokeWidth={1.8} aria-hidden />
                  {post.viewCount.toLocaleString("ko-KR")}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <MessageCircle size={13} strokeWidth={1.8} aria-hidden />
                  {post.commentCount.toLocaleString("ko-KR")}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <ThumbsUp size={13} strokeWidth={1.8} aria-hidden />
                  {post.likeCount.toLocaleString("ko-KR")}
                </span>
              </div>
            </div>

            {post.thumbnailUrl ? (
              <span className="h-12 w-[72px] shrink-0 overflow-hidden rounded-[var(--ui-control-radius)] bg-[var(--ui-surface-muted)] sm:h-[58px] sm:w-24">
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
