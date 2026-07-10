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
  return <>
    <div className="relative">
    <Swiper modules={[Navigation]} {...navigationProps} spaceBetween={16} slidesPerView={2.2} breakpoints={{ 720: { slidesPerView: 4 }, 1180: { slidesPerView: 6 } }}>
      {slides.map((item, index) => (
        <SwiperSlide key={item.id} className="h-auto">
          <button type="button" onClick={() => setOpenIndex(index)} className="group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-[#f1f2f4] text-left">
            {item.imageUrl ? <img src={proxyUrl(item.imageUrl)} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/> : null}
            <InstagramIcon className="absolute right-3 top-3 h-5 w-5 text-white drop-shadow"/>
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 px-3 pb-3 pt-8 text-xs font-bold text-white">{item.ownerName}</span>
          </button>
        </SwiperSlide>
      ))}
    </Swiper>
      <SwiperNav setPrevEl={setPrevEl} setNextEl={setNextEl} />
    </div>
    {openIndex !== null ? <InstagramPostModal items={items} startIndex={openIndex} onClose={() => setOpenIndex(null)}/> : null}
  </>;
}
