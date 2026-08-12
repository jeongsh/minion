"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Swiper as SwiperInstance } from "swiper";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
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

function PlayerProfileCard({ player, teamSlug }: { player: Player; teamSlug: string }) {
  return (
    <Link
      href={`/fan/${teamSlug}/players/${player.slug}`}
      className="group block h-full overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] transition duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--team-primary)_42%,var(--ui-border))] hover:shadow-lg hover:shadow-black/5"
    >
      <div className="relative aspect-[4/5] overflow-hidden border-b border-[var(--ui-border)] bg-[var(--ui-card-bg)]">
        {player.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.profileImageUrl} alt={player.name} loading="lazy" decoding="async" className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center text-lg font-black text-[var(--ui-muted)]">
            {player.name.slice(0, 2)}
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full border border-[color-mix(in_srgb,var(--ui-border)_78%,transparent)] bg-[var(--ui-surface)] px-2.5 py-1 text-[12px] font-black text-[var(--ui-ink)] shadow-sm backdrop-blur">
          {POSITION_LABEL[player.position]}
        </span>
      </div>
      <div className="px-3.5 py-3.5">
        <p className="truncate text-base font-black text-[var(--ui-ink)]">{player.name}</p>
        <p className="mt-0.5 truncate text-[13px] text-[var(--ui-muted)]">{player.realName || "프로필 준비 중"}</p>
      </div>
    </Link>
  );
}

export function FanPlayerProfiles({ players, teamSlug }: { players: Player[]; teamSlug: string }) {
  const orderedPlayers = [...players].sort(byRosterPriority);
  const hasMultiplePlayers = orderedPlayers.length > 1;
  const [isSwiperReady, setIsSwiperReady] = useState(false);
  const readyFrameRef = useRef<number | null>(null);

  function handleSwiperReady(swiper: SwiperInstance) {
    swiper.update();

    if (readyFrameRef.current !== null) {
      window.cancelAnimationFrame(readyFrameRef.current);
    }

    readyFrameRef.current = window.requestAnimationFrame(() => {
      swiper.update();
      setIsSwiperReady(true);
      readyFrameRef.current = null;
    });
  }

  useEffect(() => {
    return () => {
      if (readyFrameRef.current !== null) {
        window.cancelAnimationFrame(readyFrameRef.current);
      }
    };
  }, []);

  return (
    <section id="players" className="fan-card p-5 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold tracking-[-0.01em]">선수</h2>
        <Link
          href={`/fan/${teamSlug}/players`}
          className="rounded-full border border-[var(--ui-border)] px-4 py-2 text-sm font-bold text-[var(--ui-muted)] transition hover:border-[var(--team-primary)] hover:text-[var(--ui-ink)]"
        >
          전체 보기
        </Link>
      </div>

      <div className="mt-4">
        <div className="mb-3 hidden justify-end md:flex">
          {hasMultiplePlayers ? (
            <div className="flex gap-2">
              <button
                className="fan-player-swiper-prev grid h-10 w-10 place-items-center rounded-full border border-[var(--ui-border)] text-[var(--ui-muted)] transition hover:border-[var(--team-primary)] hover:text-[var(--ui-ink)] disabled:cursor-wait disabled:opacity-50"
                type="button"
                aria-label="이전 선수"
                disabled={!isSwiperReady}
              >
                <ChevronLeft size={18} strokeWidth={2.75} />
              </button>
              <button
                className="fan-player-swiper-next grid h-10 w-10 place-items-center rounded-full border border-[var(--ui-border)] text-[var(--ui-muted)] transition hover:border-[var(--team-primary)] hover:text-[var(--ui-ink)] disabled:cursor-wait disabled:opacity-50"
                type="button"
                aria-label="다음 선수"
                disabled={!isSwiperReady}
              >
                <ChevronRight size={18} strokeWidth={2.75} />
              </button>
            </div>
          ) : null}
        </div>
        <div
          className="relative"
          aria-busy={!isSwiperReady}
          data-page-readiness={isSwiperReady ? "ready" : "pending"}
        >
          <div
            className={`${
              isSwiperReady ? "invisible absolute inset-x-0 top-0" : "relative"
            } grid grid-cols-2 gap-[14px] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`}
            aria-hidden={isSwiperReady}
          >
            {orderedPlayers.slice(0, 5).map((player) => (
              <PlayerProfileCard key={player.id} player={player} teamSlug={teamSlug} />
            ))}
          </div>

          <div
            className={isSwiperReady ? "relative" : "invisible absolute inset-x-0 top-0"}
            aria-hidden={!isSwiperReady}
          >
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
              onAfterInit={handleSwiperReady}
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
                  <PlayerProfileCard player={player} teamSlug={teamSlug} />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </div>
    </section>
  );
}
