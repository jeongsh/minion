"use client";

import { useState } from "react";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { InstagramIcon, InstagramPostModal, proxyUrl } from "@/components/fan/instagram-post-modal";
import type { FeedInstaItem } from "@/components/fan/fan-feed-mosaic";
import { SwiperNav, useSwiperNav } from "@/components/ui/swiper-nav";

export function FanSocialPreview({ items }: { items: FeedInstaItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { setPrevEl, setNextEl, navigationProps } = useSwiperNav();
  const slides = items.slice(0, 12);

  if (!slides.length) {
    return (
      <div className="fan-empty-state">
        <span className="fan-empty-state__badge">SOCIAL FEED</span>
        <strong>아직 보여줄 소셜 피드가 없습니다.</strong>
        <span>새 게시물이 잡히면 팬 홈에 먼저 띄워둘게요.</span>
      </div>
    );
  }

  return <>
    <div className="relative">
    <Swiper modules={[Navigation]} {...navigationProps} spaceBetween={10} slidesPerView={2.45} breakpoints={{ 640: { slidesPerView: 3.4, spaceBetween: 12 }, 900: { slidesPerView: 4.5, spaceBetween: 14 }, 1180: { slidesPerView: 6, spaceBetween: 16 } }}>
      {slides.map((item, index) => (
        <SwiperSlide key={item.id} className="h-auto">
          <button type="button" onClick={() => setOpenIndex(index)} className="fan-social-card group relative block aspect-[4/5] w-full overflow-hidden rounded-xl bg-[#f1f2f4] text-left sm:rounded-2xl">
            {item.imageUrl ? <img src={proxyUrl(item.imageUrl)} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/> : null}
            <InstagramIcon className="absolute right-2 top-2 h-4 w-4 text-white sm:right-3 sm:top-3 sm:h-5 sm:w-5"/>
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 px-2.5 pb-2.5 pt-7 text-[12px] font-bold text-white sm:px-3 sm:pb-3 sm:pt-8 sm:text-[13px]">{item.ownerName}</span>
          </button>
        </SwiperSlide>
      ))}
    </Swiper>
      <div className="hidden sm:block">
        <SwiperNav setPrevEl={setPrevEl} setNextEl={setNextEl} />
      </div>
    </div>
    {openIndex !== null ? <InstagramPostModal items={items} startIndex={openIndex} onClose={() => setOpenIndex(null)}/> : null}
  </>;
}
