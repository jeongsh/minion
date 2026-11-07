/**
 * 웹 Swiper의 `slidesPerView`/`spaceBetween`/`breakpoints`(window 폭 기준)와 같은 슬라이드 폭을 계산한다.
 * 슬라이드 폭 = (컨테이너 폭 - (slidesPerView - 1) * spaceBetween) / slidesPerView
 */
export type SwiperLayoutConfig = {
  slidesPerView: number;
  spaceBetween: number;
  breakpoints?: Record<number, Partial<Pick<SwiperLayoutConfig, 'slidesPerView' | 'spaceBetween'>>>;
};

export function swiperLayout(config: SwiperLayoutConfig, windowWidth: number, containerWidth: number) {
  let { slidesPerView, spaceBetween } = config;
  const points = Object.keys(config.breakpoints ?? {}).map(Number).sort((a, b) => a - b);
  for (const point of points) {
    if (windowWidth < point) break;
    const override = config.breakpoints![point];
    slidesPerView = override.slidesPerView ?? slidesPerView;
    spaceBetween = override.spaceBetween ?? spaceBetween;
  }
  const slideWidth = Math.max(0, (containerWidth - (slidesPerView - 1) * spaceBetween) / slidesPerView);
  return { slideWidth, spaceBetween };
}

/** 웹 `components/domain/home-match-swiper.tsx` */
export const HOME_MATCH_SWIPER: SwiperLayoutConfig = {
  slidesPerView: 1.1,
  spaceBetween: 12,
  breakpoints: { 640: { slidesPerView: 2, spaceBetween: 12 }, 1024: { slidesPerView: 3, spaceBetween: 12 }, 1280: { slidesPerView: 4, spaceBetween: 12 } },
};

/** 웹 `components/domain/home-pom-swiper.tsx`, `components/domain/home-insights.tsx` */
export const HOME_CARD_SWIPER: SwiperLayoutConfig = {
  slidesPerView: 2.2,
  spaceBetween: 12,
  breakpoints: { 520: { slidesPerView: 3.2, spaceBetween: 12 }, 768: { slidesPerView: 4.2, spaceBetween: 14 }, 1024: { slidesPerView: 5.2, spaceBetween: 16 }, 1280: { slidesPerView: 6, spaceBetween: 16 } },
};
