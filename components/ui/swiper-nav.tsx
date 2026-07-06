"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Swiper 네비게이션(이전/다음) 버튼을 Lucide 아이콘으로 렌더링하기 위한 헬퍼.
 * 같은 페이지에 캐러셀이 여러 개 있어도 인스턴스별로 연결되므로 안전하다.
 *
 * 콜백 ref로 버튼 DOM을 state에 담아 navigation에 넘긴다. 버튼이 마운트되면
 * state가 갱신되며 Swiper가 해당 요소로 navigation을 재초기화한다. (요소가
 * 바뀔 때만 navigation 객체 identity가 변하도록 useMemo로 고정한다.)
 *
 * 사용법:
 *   const { setPrevEl, setNextEl, navigationProps } = useSwiperNav();
 *   <div className="relative">
 *     <Swiper modules={[Navigation]} {...navigationProps}>…</Swiper>
 *     <SwiperNav setPrevEl={setPrevEl} setNextEl={setNextEl} />
 *   </div>
 */
export function useSwiperNav() {
  const [prevEl, setPrevEl] = useState<HTMLButtonElement | null>(null);
  const [nextEl, setNextEl] = useState<HTMLButtonElement | null>(null);

  const navigationProps = useMemo(
    () => ({ navigation: { prevEl, nextEl } }),
    [prevEl, nextEl],
  );

  return { setPrevEl, setNextEl, navigationProps };
}

export function SwiperNav({
  setPrevEl,
  setNextEl,
  size = 20,
}: {
  setPrevEl: (el: HTMLButtonElement | null) => void;
  setNextEl: (el: HTMLButtonElement | null) => void;
  size?: number;
}) {
  return (
    <>
      <button
        ref={setPrevEl}
        type="button"
        aria-label="이전"
        className="swiper-nav-btn swiper-nav-btn--prev"
      >
        <ChevronLeft size={size} strokeWidth={2.75} />
      </button>
      <button
        ref={setNextEl}
        type="button"
        aria-label="다음"
        className="swiper-nav-btn swiper-nav-btn--next"
      >
        <ChevronRight size={size} strokeWidth={2.75} />
      </button>
    </>
  );
}
