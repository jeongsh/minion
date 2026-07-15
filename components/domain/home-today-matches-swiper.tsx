"use client";

import type { ReactNode } from "react";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { SwiperNav, useSwiperNav } from "@/components/ui/swiper-nav";

/**
 * 오늘의 매치가 2개를 넘을 때 데스크탑에서 2개씩 보여주고 좌우로 넘기는 스와이퍼.
 * 카드는 서버에서 렌더한 노드를 슬라이드로 받아 그대로 감싼다.
 */
export function HomeTodayMatchesSwiper({
  slides,
}: {
  slides: { id: string; node: ReactNode }[];
}) {
  const { setPrevEl, setNextEl, navigationProps } = useSwiperNav();
  return (
    <div className="home-today-match-grid relative">
      <Swiper
        modules={[Navigation]}
        {...navigationProps}
        slidesPerView={2}
        spaceBetween={16}
        roundLengths
      >
        {slides.map(({ id, node }) => (
          <SwiperSlide key={id} className="h-auto">
            {node}
          </SwiperSlide>
        ))}
      </Swiper>
      <SwiperNav setPrevEl={setPrevEl} setNextEl={setNextEl} />
    </div>
  );
}
