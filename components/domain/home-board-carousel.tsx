"use client";

import Link from "next/link";
import { Eye, MessageCircle } from "lucide-react";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { CommunityPostDetail } from "@/lib/community/types";
import { boardLabel } from "@/lib/community/boards";
import { SwiperNav, useSwiperNav } from "@/components/ui/swiper-nav";

function timeLabel(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff >= 0 && diff < 86400000) return `${Math.max(1, Math.floor(diff / 3600000))}시간 전`;
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replace(/\. /g, "-").replace(".", "");
}

export function HomeBoardCarousel({ posts }: { posts: CommunityPostDetail[] }) {
  const { setPrevEl, setNextEl, navigationProps } = useSwiperNav();
  if (posts.length === 0) return <div className="rounded-2xl border border-dashed border-[#d8d5dd] py-14 text-center text-sm text-[#827e89] dark:border-transparent">등록된 허브 커뮤니티 글이 없습니다.</div>;
  return <div className="relative"><Swiper modules={[Navigation]} {...navigationProps} spaceBetween={16} slidesPerView={1.08} breakpoints={{ 720: { slidesPerView: 2 }, 1280: { slidesPerView: 3 } }}>
    {posts.slice(0,12).map((post) => (
      <SwiperSlide key={post.id} className="h-auto">
        <Link href={`/community/post/${post.id}`} className={`relative grid min-h-[210px] gap-4 rounded-2xl border border-[#dedfe2] bg-[#f1f2f3] p-5 transition hover:border-[#b9bcc2] dark:border-transparent dark:hover:border-transparent ${post.thumbnailUrl ? "grid-cols-[minmax(0,1fr)_92px]" : "grid-cols-1"}`}>
          <span className="absolute right-5 top-5 text-xs text-[#85818d]">{timeLabel(post.createdAt)}</span>
          <div className="min-w-0 overflow-hidden">
            <div className="flex min-w-0 items-center gap-2 pr-24">
              {post.authorImageUrl ? <img src={post.authorImageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover"/> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#18191c] text-[11px] font-black text-white">LCK</span>}
              <b className="min-w-0 truncate text-sm">{post.authorName ?? "MINION"}</b>
            </div>
            <div className="mt-5 flex min-w-0 items-center gap-2 overflow-hidden">
              <span className="shrink-0 rounded bg-[#dfe1e4] px-2 py-1 text-[11px] font-black text-[#35373b]">{boardLabel("hub", post.boardType)}</span>
              <strong className="min-w-0 flex-1 truncate text-sm">{post.title}</strong>
            </div>
            <p className="mt-3 line-clamp-2 max-w-full [overflow-wrap:anywhere] text-sm leading-6 text-[#666a70]">{post.excerpt || "내용을 확인하려면 게시글을 열어보세요."}</p>
            <div className="mt-4 flex gap-4 text-xs font-bold text-[#8c9096]"><span className="flex items-center gap-1"><MessageCircle size={14}/>{post.commentCount}</span><span className="flex items-center gap-1"><Eye size={14}/>{post.viewCount.toLocaleString("ko-KR")}</span></div>
          </div>
          {post.thumbnailUrl ? <span className="aspect-square w-full self-center overflow-hidden rounded-xl"><img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover"/></span> : null}
        </Link>
      </SwiperSlide>
    ))}
  </Swiper>
    <SwiperNav setPrevEl={setPrevEl} setNextEl={setNextEl} />
  </div>;
}
