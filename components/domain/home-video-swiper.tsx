"use client";

import { Play } from "lucide-react";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";

import { SwiperNav, useSwiperNav } from "@/components/ui/swiper-nav";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";
import type { HomeVideo } from "@/lib/data/lck-channel-videos";

export function HomeVideoSwiper({ videos }: { videos: HomeVideo[] }) {
  const { setPrevEl, setNextEl, navigationProps } = useSwiperNav();

  if (!videos.length) {
    return (
      <KitschEmptyState
        character="megapon"
        title="영상 큐가 잠깐 비었어요"
        body="새 클립이 들어오면 바로 플레이 버튼을 올려둘게요."
        animated
      />
    );
  }

  return (
    <div className="relative">
      <Swiper
        modules={[Navigation]}
        {...navigationProps}
        spaceBetween={12}
        slidesPerView={1.18}
        breakpoints={{
          520: { slidesPerView: 1.65, spaceBetween: 12 },
          768: { slidesPerView: 2.35, spaceBetween: 14 },
          1024: { slidesPerView: 4.15, spaceBetween: 16 },
          1280: { slidesPerView: 5, spaceBetween: 16 },
        }}
      >
        {videos.map((video) => (
          <SwiperSlide key={video.id} className="h-auto">
            <a
              href={video.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="group block h-full min-w-0"
            >
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#202124]">
                {video.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                <span className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-full bg-[#00e58e]">
                  <Play size={16} fill="currentColor" />
                </span>
              </div>
              <b className="mt-3 line-clamp-2 block text-sm leading-5 text-[var(--ui-ink)]">
                {video.title}
              </b>
              <span className="mt-2 inline-flex max-w-full items-center truncate rounded-full border border-[var(--ui-muted)] px-2 py-0.5 text-[12px] font-medium leading-4 text-[var(--ui-muted)] sm:text-[13px]">
                {video.channelName}
              </span>
            </a>
          </SwiperSlide>
        ))}
      </Swiper>
      <div className="hidden sm:block">
        <SwiperNav setPrevEl={setPrevEl} setNextEl={setNextEl} />
      </div>
    </div>
  );
}
