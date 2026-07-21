"use client";

import Link from "next/link";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";

import { SwiperNav, useSwiperNav } from "@/components/ui/swiper-nav";
import { useSwiperResize } from "@/components/ui/use-swiper-resize";
import type { HomePomEntry } from "@/lib/data/home-pom";

// 카드 배경 워터마크용 라인 아이콘(/public/objectives/). 주간 리포트 선수 카드와 같은 세트.
const POSITION_ICON: Record<string, string> = {
  TOP: "position-top",
  JGL: "position-jungle",
  MID: "position-middle",
  BOT: "position-bottom",
  SUP: "position-utility",
};

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
            <Link href={entry.href} className="group block h-full min-w-0">
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
                    className="relative z-1 h-full w-full object-cover object-top transition duration-300 group-hover:scale-105"
                  />
                ) : null}
                <span className="absolute z-2 inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
                {entry.tournamentName ? (
                  <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-white/90 backdrop-blur-sm">
                    {entry.tournamentName}
                  </span>
                ) : null}
                <span className="absolute bottom-2 left-2 right-2 min-w-0 z-3">
                  <span className="flex min-w-0 items-baseline gap-1">
                    <b className="min-w-0 truncate text-sm leading-5 text-white">{entry.playerName}</b>
                    <span className="shrink-0 text-[10px] font-semibold leading-4 text-white/60">
                      {entry.position}
                    </span>
                  </span>
                  {/* 소속팀 로고 + "우리팀 스코어 상대팀" 순서로 둬야 어느 쪽이 팀이고 상대인지 헷갈리지 않는다. */}
                  <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] font-semibold leading-4">
                    {entry.teamLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.teamLogoUrl}
                        alt=""
                        loading="lazy"
                        className="h-[18px] w-[18px] shrink-0 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                      />
                    ) : null}
                    <span className="truncate text-white">{entry.teamShortName}</span>
                    {entry.scoreLabel ? (
                      <span className="shrink-0 rounded bg-white/20 px-1 text-[10px] tabular-nums text-white">
                        {entry.scoreLabel}
                      </span>
                    ) : null}
                    {entry.opponentShortName ? (
                      <span className="truncate text-white/60">{entry.opponentShortName}</span>
                    ) : null}
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
