"use client";

import Link from "next/link";
import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

export type HomeHeroSwiperSlide = {
  id: string;
  imageUrl: string;
  alt: string;
  href?: string;
};

export function HomeHeroSwiper({ slides }: { slides: HomeHeroSwiperSlide[] }) {
  const safeSlides = slides.filter((slide) => slide.imageUrl);

  return (
    <section className="relative min-h-[380px] overflow-hidden rounded-2xl bg-[#071332] shadow-sm">
      {safeSlides.length > 0 ? (
        <Swiper
          modules={[Autoplay, Pagination]}
          autoplay={{ delay: 4500, disableOnInteraction: false }}
          loop={safeSlides.length > 1}
          pagination={{ clickable: true }}
          className="home-hero-swiper h-[380px]"
        >
          {safeSlides.map((slide) => (
            <SwiperSlide key={slide.id}>
              {slide.href ? (
                <Link href={slide.href} className="block h-full w-full">
                  <img src={slide.imageUrl} alt={slide.alt} className="h-full w-full object-cover" />
                </Link>
              ) : (
                <img src={slide.imageUrl} alt={slide.alt} className="h-full w-full object-cover" />
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <div className="h-[380px] bg-[#071332]" />
      )}
    </section>
  );
}
