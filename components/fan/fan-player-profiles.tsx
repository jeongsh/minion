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
      className="group block h-full overflow-hidden rounded-2xl border border-[#e6e9ef] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-lg hover:shadow-black/5"
    >
      <div className="relative aspect-square bg-[#eef1f6]">
        {player.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.profileImageUrl} alt={player.name} className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full items-center justify-center text-lg font-black text-muted">
            {player.name.slice(0, 2)}
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-accent shadow-sm backdrop-blur">
          {POSITION_LABEL[player.position]}
        </span>
      </div>
      <div className="px-3 py-3.5">
        <p className="truncate text-base font-black group-hover:text-accent">{player.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{player.realName || "프로필 준비 중"}</p>
      </div>
    </Link>
  );
}

export function FanPlayerProfiles({ players, teamSlug }: { players: Player[]; teamSlug: string }) {
  const orderedPlayers = [...players].sort(byRosterPriority);
  const hasMultiplePlayers = orderedPlayers.length > 1;

  return (
    <section id="players" className="rounded-3xl border border-[#e6e9ef] bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Team roster</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.02em]">우리 팀 선수</h2>
        </div>
        <Link
          href={`/fan/${teamSlug}/players`}
          className="rounded-full border border-[#dfe3ea] px-4 py-2 text-sm font-bold text-[#475467] transition hover:border-accent hover:text-accent"
        >
          전체 보기 →
        </Link>
      </div>

      <div className="mt-4">
        <div className="mb-3 hidden justify-end md:flex">
          {hasMultiplePlayers ? (
            <div className="flex gap-2">
              <button
                className="fan-player-swiper-prev rounded-full border border-border px-3 py-2 text-sm font-black hover:border-accent hover:text-accent"
                type="button"
                aria-label="이전 선수"
              >
                ‹
              </button>
              <button
                className="fan-player-swiper-next rounded-full border border-border px-3 py-2 text-sm font-black hover:border-accent hover:text-accent"
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
          spaceBetween={14}
          slidesPerView={2.15}
          breakpoints={{
            640: { slidesPerView: 3.25 },
            768: { slidesPerView: 4.25 },
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
