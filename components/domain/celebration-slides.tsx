"use client";

import { Children, useRef, type ReactNode } from "react";
import type { Swiper as SwiperInstance } from "swiper";
import { A11y, Autoplay, Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

import { useSwiperResize } from "@/components/ui/use-swiper-resize";

export function CelebrationSlides({ children }: { children: ReactNode }) {
  const swiperRef = useRef<SwiperInstance | null>(null);
  const setSwiper = useSwiperResize();

  return (
    <div
      className="min-w-0"
      role="region"
      aria-label="축하 배너"
      aria-roledescription="슬라이드"
      onFocusCapture={() => swiperRef.current?.autoplay.stop()}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) swiperRef.current?.autoplay.start();
      }}
    >
      <Swiper
        modules={[A11y, Autoplay, Keyboard]}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          setSwiper(swiper);
        }}
        slidesPerView={1}
        spaceBetween={12}
        loop
        autoplay={{ delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true }}
        keyboard={{ enabled: true, onlyInViewport: true }}
        a11y={{ slideLabelMessage: "{{slidesLength}}개 중 {{index}}번째 배너" }}
        className="rounded-2xl"
      >
        {Children.toArray(children).map((child) => (
          <SwiperSlide key={(child as { key: string }).key}>
            {({ isActive }) => <div inert={!isActive}>{child}</div>}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
