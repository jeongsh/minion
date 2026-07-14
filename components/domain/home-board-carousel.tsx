"use client";

import Link from "next/link";
import { Eye, MessageCircle } from "lucide-react";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import type { CommunityPostDetail } from "@/lib/community/types";
import { boardLabel } from "@/lib/community/boards";
import { SwiperNav, useSwiperNav } from "@/components/ui/swiper-nav";

function timeLabel(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff >= 0 && diff < 86400000) return `${Math.max(1, Math.floor(diff / 3600000))}시간 전`;
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replace(/\. /g, "-").replace(".", "");
}

export function HomeBoardCarousel({
  posts,
  scope = "hub",
  teamSlug,
}: {
  posts: CommunityPostDetail[];
  scope?: "hub" | "team";
  teamSlug?: string;
}) {
  const { setPrevEl, setNextEl, navigationProps } = useSwiperNav();
  const detailHref = (postId: string) =>
    scope === "team" && teamSlug ? `/fan/${teamSlug}/community/post/${postId}` : `/community/post/${postId}`;
  if (posts.length === 0) return <div className="rounded-2xl border border-dashed border-[#d8d5dd] py-14 text-center text-sm text-[#827e89] dark:border-transparent">등록된 {scope === "team" ? "팬" : "허브"} 커뮤니티 글이 없습니다.</div>;
  return <div className="relative"><Swiper modules={[Navigation]} {...navigationProps} spaceBetween={12} slidesPerView={1.16} breakpoints={{ 640: { slidesPerView: 2, spaceBetween: 14 }, 1280: { slidesPerView: 3, spaceBetween: 16 } }}>
    {posts.slice(0,12).map((post) => (
      <SwiperSlide key={post.id} className="h-auto">
        <Link href={detailHref(post.id)} className={`relative grid h-full min-h-[156px] gap-2.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3.5 transition hover:border-[var(--ui-muted)] sm:min-h-[196px] sm:gap-4 sm:rounded-2xl sm:p-5 ${post.thumbnailUrl ? "grid-cols-[minmax(0,1fr)_74px] sm:grid-cols-[minmax(0,1fr)_92px]" : "grid-cols-1"}`}>
          <span className="absolute right-3.5 top-3.5 text-[12px] text-[var(--ui-muted)] sm:right-5 sm:top-5 sm:text-[13px]">{timeLabel(post.createdAt)}</span>
          <div className="flex h-full min-w-0 flex-col overflow-hidden">
            <div className="flex min-w-0 items-center gap-2 pr-20 sm:pr-24">
              {post.authorImageUrl ? <img src={post.authorImageUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover sm:h-8 sm:w-8"/> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--ui-ink)] text-[12px] font-medium text-[var(--ui-surface)] sm:h-8 sm:w-8 sm:text-[13px]">LCK</span>}
              <b className="min-w-0 truncate text-[13px] text-[var(--ui-ink)] sm:text-sm">{post.authorName ?? "MINION"}</b>
            </div>
            <div className="mt-4 flex min-w-0 items-center gap-2 overflow-hidden sm:mt-5">
              <span className="shrink-0 rounded bg-[var(--ui-surface)] px-2 py-1 text-[12px] font-medium text-[var(--ui-text)] sm:text-[13px]">{boardLabel(scope, post.boardType)}</span>
              <strong className="min-w-0 flex-1 truncate text-[13px] text-[var(--ui-ink)] sm:text-sm">{post.title}</strong>
            </div>
            <p className="mt-2 h-10 line-clamp-2 max-w-full [overflow-wrap:anywhere] text-[14px] leading-5 text-[#666a70] sm:mt-3 sm:h-12 sm:text-[15px] sm:leading-6">{post.excerpt || "내용을 확인하려면 게시글을 열어보세요."}</p>
            <div className="mt-auto flex gap-4 pt-3 text-[12px] font-bold text-[#8c9096] sm:pt-4 sm:text-[13px]"><span className="flex items-center gap-1"><MessageCircle size={14}/>{post.commentCount}</span><span className="flex items-center gap-1"><Eye size={14}/>{post.viewCount.toLocaleString("ko-KR")}</span></div>
          </div>
          {post.thumbnailUrl ? <span className="aspect-square w-full self-center overflow-hidden rounded-lg sm:rounded-xl"><img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover"/></span> : null}
        </Link>
      </SwiperSlide>
    ))}
  </Swiper>
    <div className="hidden sm:block">
      <SwiperNav setPrevEl={setPrevEl} setNextEl={setNextEl} />
    </div>
  </div>;
}
