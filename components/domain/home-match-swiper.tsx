"use client";

import { useRef, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import { HomeMatchCard, type HomeMatchItem } from "@/components/domain/home-match-card";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";
import { useSwiperResize } from "@/components/ui/use-swiper-resize";

function SwipeNavigationGuard({
  children,
  suppressClickRef,
}: {
  children: ReactNode;
  suppressClickRef: RefObject<boolean>;
}) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;

    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    suppressClickRef.current = false;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || event.pointerType !== "mouse") return;

    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
      suppressClickRef.current = true;
    }
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    pointerStartRef.current = null;
    if (!suppressClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  return (
    <div
      onPointerDownCapture={handlePointerDown}
      onPointerMoveCapture={handlePointerMove}
      onClickCapture={handleClick}
    >
      {children}
    </div>
  );
}

/**
 * 홈 매치 섹션. 예전에는 "오늘의 매치"(가로 2열 그리드)와 "다가오는 매치"(세로 스크롤
 * 목록)로 나뉘어 있었는데, 오늘 예정 경기가 양쪽에 중복 노출되고 세로 스크롤이
 * 생겼다. 하나의 가로 캐러셀로 합쳐 중복과 세로 스크롤을 함께 없앤다.
 */
export function HomeMatchSwiper({
  items,
  variant = "carousel",
}: {
  items: HomeMatchItem[];
  /**
   * carousel — 섹션용 가로 캐러셀(데스크탑).
   * single — 상단 "매치" 패널용. 한 장씩 넘기고 아래에 페이지 점을 둔다(모바일).
   */
  variant?: "carousel" | "single";
}) {
  const setSwiper = useSwiperResize();
  const suppressClickRef = useRef(false);

  if (!items.length) {
    return (
      <KitschEmptyState
        character="flag"
        title="다음 매치 대기 중"
        body="경기 일정이 잡히면 바로 응원판을 열어둘게요."
        compact={variant === "single"}
        animated
      />
    );
  }

  if (variant === "single") {
    return (
      <SwipeNavigationGuard suppressClickRef={suppressClickRef}>
        <Swiper
          modules={[Pagination]}
          onSwiper={setSwiper}
          onSliderMove={() => {
            suppressClickRef.current = true;
          }}
          slidesPerView={1}
          spaceBetween={10}
          pagination={{ clickable: true }}
          preventClicks
          preventClicksPropagation
          className="home-upcoming-swiper !pb-7"
        >
          {items.map((item) => (
            <SwiperSlide key={item.match.id} className="h-auto">
              <HomeMatchCard {...item} />
            </SwiperSlide>
          ))}
        </Swiper>
      </SwipeNavigationGuard>
    );
  }

  return (
    <SwipeNavigationGuard suppressClickRef={suppressClickRef}>
      <Swiper
        onSwiper={setSwiper}
        onSliderMove={() => {
          suppressClickRef.current = true;
        }}
        spaceBetween={12}
        slidesPerView={1.1}
        preventClicks
        preventClicksPropagation
        className="cursor-grab active:cursor-grabbing"
        breakpoints={{
          640: { slidesPerView: 2, spaceBetween: 12 },
          1024: { slidesPerView: 3, spaceBetween: 12 },
          1280: { slidesPerView: 4, spaceBetween: 12 },
        }}
      >
        {items.map((item) => (
          <SwiperSlide key={item.match.id} className="h-auto">
            <HomeMatchCard {...item} />
          </SwiperSlide>
        ))}
      </Swiper>
    </SwipeNavigationGuard>
  );
}
