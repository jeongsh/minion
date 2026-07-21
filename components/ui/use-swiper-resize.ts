"use client";

import { useEffect, useState } from "react";
import type { Swiper as SwiperClass } from "swiper";

/**
 * Swiper는 초기화 시점의 컨테이너 폭으로 슬라이드 폭을 계산해두고, 이후 컨테이너가
 * 넓어지거나 좁아져도(사이드바 접기/펼치기, 폰트 로드 후 레이아웃 확정 등) 다시 재지 않는다.
 * 그 결과 슬라이드가 옛 폭에 머물러 카드가 잘린 채로 남는다.
 * 컨테이너를 직접 관찰해 update()를 강제한다.
 *
 * 사용법:
 *   const setSwiper = useSwiperResize();
 *   <Swiper onSwiper={setSwiper} …>
 */
export function useSwiperResize() {
  const [swiper, setSwiper] = useState<SwiperClass | null>(null);

  useEffect(() => {
    const el = swiper?.el;
    if (!el || swiper.destroyed) return;

    const observer = new ResizeObserver(() => {
      if (!swiper.destroyed) swiper.update();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [swiper]);

  return setSwiper;
}
