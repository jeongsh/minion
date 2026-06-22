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

function PlayerProfileCard({ player, compact = false }: { player: Player; compact?: boolean }) {
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
        {player.isStarter ? (
          <span className="absolute right-2 top-2 rounded-md bg-accent px-2 py-1 text-xs font-black text-accent-foreground">
            STARTER
          </span>
        ) : null}
      </div>
      <div className={`${compact ? "p-3" : "p-3"} text-center`}>
        <p className="truncate text-sm font-black">{player.name}</p>
        <p className="mt-1 truncate text-xs text-muted">{player.realName || "프로필 준비 중"}</p>
      </div>
    </Link>
  );
}

export function FanPlayerProfiles({ players }: { players: Player[] }) {
  const orderedPlayers = [...players].sort(byRosterPriority);
  const explicitStarters = orderedPlayers.filter((player) => player.isStarter);
  const fallbackStarters =
    explicitStarters.length >= 5
      ? explicitStarters.slice(0, 5)
      : [
          ...explicitStarters,
          ...orderedPlayers
            .filter((player) => !explicitStarters.some((starter) => starter.id === player.id))
            .slice(0, 5 - explicitStarters.length),
        ];
  const featuredIds = new Set(fallbackStarters.map((player) => player.id));
  const benchPlayers = orderedPlayers.filter((player) => !featuredIds.has(player.id));
  const hasMultipleBenchPlayers = benchPlayers.length > 1;

  return (
    <section id="players" className="rounded-md border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black text-accent">STARTING ROSTER</p>
          <h2 className="mt-1 text-xl font-black tracking-normal">선수 프로필</h2>
        </div>
        <Link
          href="#players"
          className="rounded-md border border-accent px-3 py-2 text-sm font-bold text-accent hover:bg-surface-muted"
        >
          선수 전체 보기
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        {fallbackStarters.map((player) => (
          <PlayerProfileCard key={player.id} player={player} />
        ))}
      </div>

      {benchPlayers.length > 0 ? (
        <div className="mt-6 border-t border-border pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-muted">SUB PLAYERS</p>
              <h3 className="text-base font-black tracking-normal">서브 선수</h3>
            </div>
            {hasMultipleBenchPlayers ? (
              <div className="flex gap-2">
                <button
                  className="fan-player-swiper-prev rounded-md border border-border px-3 py-2 text-sm font-black hover:border-accent hover:text-accent"
                  type="button"
                  aria-label="이전 서브 선수"
                >
                  ‹
                </button>
                <button
                  className="fan-player-swiper-next rounded-md border border-border px-3 py-2 text-sm font-black hover:border-accent hover:text-accent"
                  type="button"
                  aria-label="다음 서브 선수"
                >
                  ›
                </button>
              </div>
            ) : null}
          </div>
          <Swiper
            modules={[Navigation]}
            navigation={
              hasMultipleBenchPlayers
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
              1024: { slidesPerView: 4.25 },
            }}
          >
            {benchPlayers.map((player) => (
              <SwiperSlide key={player.id} className="h-auto">
                <PlayerProfileCard player={player} compact />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      ) : null}
    </section>
  );
}
