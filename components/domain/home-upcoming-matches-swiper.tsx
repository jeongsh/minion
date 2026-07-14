"use client";

import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";

import { HomeUpcomingPredictionCard } from "@/components/domain/home-upcoming-prediction-card";
import type { PredictionBet } from "@/lib/predictions";
import type { Match, Team } from "@/lib/types";

type UpcomingItem = {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  tournament?: string;
  bets: PredictionBet[];
};

export function HomeUpcomingMatchesSwiper({
  items,
  currentUserId,
  balance,
}: {
  items: UpcomingItem[];
  currentUserId?: string;
  balance: number | null;
}) {
  if (!items.length) {
    return (
      <div className="grid min-h-40 place-items-center rounded-xl bg-[#fafafa] text-sm font-semibold text-[#777b82] dark:border dark:border-[#383c44] dark:bg-[#1c1e22]">
        예정된 경기가 없습니다.
      </div>
    );
  }

  return (
    <>
      <div className="xl:hidden">
        <Swiper
          modules={[Pagination]}
          slidesPerView={1}
          spaceBetween={10}
          pagination={{ clickable: true }}
          className="home-upcoming-swiper !pb-7"
        >
          {items.map(({ match, teamA, teamB, tournament, bets }) => (
            <SwiperSlide key={match.id} className="h-auto">
              <HomeUpcomingPredictionCard
                match={match}
                teamA={teamA}
                teamB={teamB}
                tournament={tournament}
                bets={bets}
                currentUserId={currentUserId}
                balance={balance}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <div className="hidden space-y-3 xl:block">
        {items.map(({ match, teamA, teamB, tournament, bets }) => (
          <HomeUpcomingPredictionCard
            key={match.id}
            match={match}
            teamA={teamA}
            teamB={teamB}
            tournament={tournament}
            bets={bets}
            currentUserId={currentUserId}
            balance={balance}
          />
        ))}
      </div>
    </>
  );
}
