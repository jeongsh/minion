"use client";

import Link from "next/link";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Player } from "@/lib/types";

const POSITION_LABEL: Record<Player["position"], string> = {
  TOP: "TOP",
  JGL: "JUG",
  MID: "MID",
  BOT: "BOT",
  SUP: "SUP",
};

const POSITION_ORDER: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];

function byRosterPriority(a: Player, b: Player) {
  const starterDiff = Number(b.isStarter) - Number(a.isStarter);

  if (starterDiff !== 0) {
    return starterDiff;
  }

  const positionDiff = POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position);

  if (positionDiff !== 0) {
    return positionDiff;
  }

  return a.name.localeCompare(b.name);
}

function PlayerProfileCard({ player }: { player: Player }) {
  return (
    <Link
      href={`/players/${player.slug}`}
      className="block h-full overflow-hidden rounded-md border border-border bg-background transition hover:border-accent"
    >
      <div className="relative aspect-[4/5] bg-surface-muted">
        {player.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.profileImageUrl} alt={player.name} className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full items-center justify-center text-lg font-black text-muted">
            {player.name.slice(0, 2)}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs font-black text-accent">
          {POSITION_LABEL[player.position]}
        </span>
      </div>
      <div className="p-3 text-center">
        <p className="truncate text-sm font-black">{player.name}</p>
        <p className="mt-1 truncate text-xs text-muted">{player.realName || "프로필 준비 중"}</p>
      </div>
    </Link>
  );
}

export function FanPlayerProfiles({ players }: { players: Player[] }) {
  const orderedPlayers = [...players].sort(byRosterPriority);
  const hasMultiplePlayers = orderedPlayers.length > 1;

  return (
    <section id="players" className="rounded-md border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black text-accent">TEAM ROSTER</p>
          <h2 className="mt-1 text-xl font-black tracking-normal">선수 프로필</h2>
        </div>
        <Link
          href="#players"
          className="rounded-md border border-accent px-3 py-2 text-sm font-bold text-accent hover:bg-surface-muted"
        >
          선수 전체 보기
        </Link>
      </div>

      <div className="mt-4">
        <div className="mb-3 flex justify-end">
          {hasMultiplePlayers ? (
            <div className="flex gap-2">
              <button
                className="fan-player-swiper-prev rounded-md border border-border px-3 py-2 text-sm font-black hover:border-accent hover:text-accent"
                type="button"
                aria-label="이전 선수"
              >
                ‹
              </button>
              <button
                className="fan-player-swiper-next rounded-md border border-border px-3 py-2 text-sm font-black hover:border-accent hover:text-accent"
                type="button"
                aria-label="다음 선수"
              >
                ›
              </button>
            </div>
          ) : null}
        </div>
        <Swiper
          modules={[Navigation]}
          navigation={
            hasMultiplePlayers
              ? {
                  prevEl: ".fan-player-swiper-prev",
                  nextEl: ".fan-player-swiper-next",
                }
              : false
          }
          spaceBetween={16}
          slidesPerView={1.35}
          breakpoints={{
            640: { slidesPerView: 2.5 },
            768: { slidesPerView: 3.25 },
            1024: { slidesPerView: 5 },
          }}
        >
          {orderedPlayers.map((player) => (
            <SwiperSlide key={player.id} className="h-auto">
              <PlayerProfileCard player={player} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
