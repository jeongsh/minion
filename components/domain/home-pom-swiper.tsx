"use client";

import Link from "next/link";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";

import { SwiperNav, useSwiperNav } from "@/components/ui/swiper-nav";
import { useSwiperResize } from "@/components/ui/use-swiper-resize";
import type { HomePomEntry } from "@/lib/data/home-pom";

export function HomePomSwiper({ entries }: { entries: HomePomEntry[] }) {
  const { setPrevEl, setNextEl, navigationProps } = useSwiperNav();
  const setSwiper = useSwiperResize();

  if (!entries.length) return null;

  return (
    <div className="relative">
      <Swiper
        modules={[Navigation]}
        {...navigationProps}
        onSwiper={setSwiper}
        spaceBetween={12}
        slidesPerView={2.2}
        breakpoints={{
          520: { slidesPerView: 3.2, spaceBetween: 12 },
          768: { slidesPerView: 4.2, spaceBetween: 14 },
          1024: { slidesPerView: 5.2, spaceBetween: 16 },
          1280: { slidesPerView: 6, spaceBetween: 16 },
        }}
      >
        {entries.map((entry) => (
          <SwiperSlide key={entry.matchId} className="h-auto">
            <Link href={`/players/${entry.playerSlug}`} className="group block h-full min-w-0">
              <div
                className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[var(--ui-surface-muted)]"
                style={entry.teamPrimaryColor ? { background: `${entry.teamPrimaryColor}1f` } : undefined}
              >
                {entry.playerImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.playerImageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-105"
                  />
                ) : null}
                <span className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />
                {entry.teamLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.teamLogoUrl}
                    alt=""
                    loading="lazy"
                    className="absolute left-2 top-2 h-6 w-6 object-contain"
                  />
                ) : null}
                <span className="absolute bottom-2 left-2 right-2 min-w-0">
                  <b className="block truncate text-sm leading-5 text-white">{entry.playerName}</b>
                  <span className="block truncate text-[12px] font-semibold leading-4 text-white/75">
                    {entry.position}
                    {entry.opponentShortName ? ` · vs ${entry.opponentShortName}` : ""}
                  </span>
                </span>
              </div>
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>
      <div className="hidden sm:block">
        <SwiperNav setPrevEl={setPrevEl} setNextEl={setNextEl} />
      </div>
    </div>
  );
}
