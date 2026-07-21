"use client";

import Link from "next/link";
import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";

export type HomeHeroSwiperSlide = {
  id: string;
  imageUrl: string;
  alt: string;
  href?: string;
};

export function HomeHeroSwiper({ slides }: { slides: HomeHeroSwiperSlide[] }) {
  const safeSlides = slides.filter((slide) => slide.imageUrl);

  return (
    <section className="relative h-full min-h-0 overflow-hidden rounded-2xl bg-[#eeeeef] shadow-sm">
      {safeSlides.length > 0 ? (
        <Swiper
          modules={[Autoplay, Pagination]}
          autoplay={{ delay: 4500, disableOnInteraction: false }}
          loop={safeSlides.length > 1}
          pagination={{ clickable: true }}
          className="home-hero-swiper h-full"
        >
          {safeSlides.map((slide, index) => (
            <SwiperSlide key={slide.id}>
              {slide.href ? (
                <Link href={slide.href} className="block h-full w-full">
                  <img src={slide.imageUrl} alt={slide.alt} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} decoding="async" className="h-full w-full object-cover" />
                </Link>
              ) : (
                <img src={slide.imageUrl} alt={slide.alt} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} decoding="async" className="h-full w-full object-cover" />
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <div className="h-full bg-[#eeeeef]" />
      )}
    </section>
  );
}
