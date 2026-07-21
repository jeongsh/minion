"use client";

import { Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import { HomeMatchCard, type HomeMatchItem } from "@/components/domain/home-match-card";
import { SwiperNav, useSwiperNav } from "@/components/ui/swiper-nav";
import { useSwiperResize } from "@/components/ui/use-swiper-resize";

/**
 * 홈 매치 섹션. 예전에는 "오늘의 매치"(가로 2열 그리드)와 "다가오는 매치"(세로 스크롤
 * 목록)로 나뉘어 있었는데, 오늘 예정 경기가 양쪽에 중복 노출되고 세로 스크롤이
 * 생겼다. 하나의 가로 캐러셀로 합쳐 중복과 세로 스크롤을 함께 없앤다.
 */
export function HomeMatchSwiper({
  items,
  currentUserId,
  balance,
  variant = "carousel",
}: {
  items: HomeMatchItem[];
  currentUserId?: string;
  balance: number | null;
  /**
   * carousel — 섹션용 가로 캐러셀(데스크탑).
   * single — 상단 "매치" 패널용. 한 장씩 넘기고 아래에 페이지 점을 둔다(모바일).
   */
  variant?: "carousel" | "single";
}) {
  const { setPrevEl, setNextEl, navigationProps } = useSwiperNav();
  const setSwiper = useSwiperResize();

  if (!items.length) {
    return (
      <div className="grid min-h-40 place-items-center rounded-2xl border border-[#e6e7ea] bg-white text-sm font-bold text-[#686b72] dark:bg-[var(--ui-surface-muted)]">
        예정된 경기가 없습니다.
      </div>
    );
  }

  if (variant === "single") {
    return (
      <Swiper
        modules={[Pagination]}
        onSwiper={setSwiper}
        slidesPerView={1}
        spaceBetween={10}
        pagination={{ clickable: true }}
        className="home-upcoming-swiper !pb-7"
      >
        {items.map((item) => (
          <SwiperSlide key={item.match.id} className="h-auto">
            <HomeMatchCard {...item} currentUserId={currentUserId} balance={balance} />
          </SwiperSlide>
        ))}
      </Swiper>
    );
  }

  return (
    <div className="relative">
      <Swiper
        modules={[Navigation]}
        {...navigationProps}
        onSwiper={setSwiper}
        spaceBetween={12}
        slidesPerView={1.1}
        breakpoints={{
          640: { slidesPerView: 2.05, spaceBetween: 14 },
          1024: { slidesPerView: 2.6, spaceBetween: 16 },
          1280: { slidesPerView: 3.15, spaceBetween: 16 },
        }}
      >
        {items.map((item) => (
          <SwiperSlide key={item.match.id} className="h-auto">
            <HomeMatchCard {...item} currentUserId={currentUserId} balance={balance} />
          </SwiperSlide>
        ))}
      </Swiper>
      <div className="hidden sm:block">
        <SwiperNav setPrevEl={setPrevEl} setNextEl={setNextEl} />
      </div>
    </div>
  );
}
