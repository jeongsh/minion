"use client";

import Link from "next/link";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import type { Player } from "@/lib/types";
import { SwiperNav, useSwiperNav } from "@/components/ui/swiper-nav";

const POSITION_LABEL: Record<string, string> = {
  TOP: "탑",
  JGL: "정글",
  MID: "미드",
  BOT: "원딜",
  SUP: "서폿",
};

function PlayerPhoto({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className: string;
}) {
  if (!src) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-[var(--ui-surface-muted)] text-sm font-black text-[var(--ui-muted)]`}
        aria-label={alt}
      >
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className={className} />
  );
}

export function PlayerRosterCarousel({ players }: { players: Player[] }) {
  const { setPrevEl, setNextEl, navigationProps } = useSwiperNav();
  return (
    <div className="relative">
    <Swiper
      modules={[Navigation]}
      {...navigationProps}
      spaceBetween={12}
      slidesPerView={2.2}
      breakpoints={{ 640: { slidesPerView: 3.2 }, 1024: { slidesPerView: 5 } }}
    >
      {players.map((player) => (
        <SwiperSlide key={player.id} className="h-auto">
          <Link
            href={`/players/${player.slug}`}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] transition-colors hover:border-[var(--tp)]"
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-[var(--ui-surface-muted)]">
              <PlayerPhoto
                src={player.profileImageUrl}
                alt={player.name}
                className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <span
                className="absolute left-2.5 top-2.5 rounded-lg px-2 py-0.5 text-[11px] font-black text-white"
                style={{ background: "var(--tp)" }}
              >
                {POSITION_LABEL[player.position] ?? player.position}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-3.5">
              <span className="font-archivo truncate text-[15px] font-black leading-tight text-[var(--ui-ink)] transition-colors group-hover:text-[var(--tp)]">
                {player.name}
              </span>
              {player.realName && (
                <span className="truncate text-xs font-semibold text-[var(--ui-muted)]">
                  {player.realName}
                </span>
              )}
            </div>
          </Link>
        </SwiperSlide>
      ))}
    </Swiper>
      <SwiperNav setPrevEl={setPrevEl} setNextEl={setNextEl} />
    </div>
  );
}
