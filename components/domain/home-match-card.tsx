"use client";

import Image from "next/image";
import Link from "next/link";
import { useSwiper } from "swiper/react";
import { useNavigationTransition } from "@/components/navigation/navigation-transition-provider";
import { TeamLogo } from "@/components/ui/team-logo";
import { isMatchLive } from "@/lib/match-display";
import { predictionMarketForMatch, type PredictionBet } from "@/lib/predictions";
import type { Match, Team } from "@/lib/types";
import { formatTimeKST, matchHref } from "@/lib/view-data";

export type HomeMatchItem = {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  tournament?: string;
  bets: PredictionBet[];
};

function tournamentLogo(name: string) {
  if (name.toLowerCase().includes("kespa")) {
    return {
      src: "/logos/tournaments/kespa-cup.webp",
      className: "h-[18px] w-[18px] shrink-0 object-contain",
    };
  }

  return {
    src: "/logos/tournaments/lck.svg",
    className: "h-[18px] w-[18px] shrink-0 object-contain dark:invert",
  };
}

function MatchTeamLogo({ team }: { team?: Team }) {
  if (!team?.logoUrl) {
    return (
      <span
        className="h-7 w-7 shrink-0 rounded-md border border-dashed border-[var(--ui-muted)] opacity-60"
        role="img"
        aria-label={team?.name ?? "미정 팀"}
      />
    );
  }

  return <TeamLogo team={team} size="h-7 w-7 shrink-0" plain />;
}

/**
 * 홈 매치 카드. 예전에는 "오늘의 매치"(예측 분포 + 매치정보/평점 링크)와
 * "다가오는 매치"(베팅 버튼) 두 종류였는데, 오늘 예정 경기가 양쪽 목록에 모두
 * 들어가 같은 경기가 한 화면에 두 번 그려졌다. 카드를 하나로 합치고
 * 예측 분포 막대는 공통으로 두되, 액션만 경기 상태에 따라 바꾼다.
 */
export function HomeMatchCard({
  match,
  teamA,
  teamB,
  tournament,
  bets,
}: HomeMatchItem) {
  const swiper = useSwiper();
  const swiperClickState = swiper as typeof swiper & { allowClick?: boolean };
  const { startNavigation } = useNavigationTransition();
  const market = predictionMarketForMatch(bets, match.id, match.teamAId, match.teamBId);
  const live = isMatchLive(match);
  const matchDateValue = new Date(match.matchDate);
  const monthDay = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).format(matchDateValue);
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(matchDateValue);
  const matchDate = `${monthDay} ${weekday}`;
  const tournamentName = tournament ?? match.name;
  const tournamentLogoAsset = tournamentLogo(tournamentName);
  const centerLabel = match.status === "completed"
    ? `${match.teamAScore ?? 0} : ${match.teamBScore ?? 0}`
    : formatTimeKST(match.matchDate);
  const href = matchHref(match);
  const matchLabel = `${teamA?.shortName ?? "TBD"} vs ${teamB?.shortName ?? "TBD"} 경기 상세`;

  return (
    <article className="group relative flex h-full min-h-[100px] min-w-0 flex-col rounded-xl bg-[var(--ui-card-bg)] p-3 transition-colors hover:bg-[var(--ui-card-hover)]">
      <Link
        href={href}
        aria-label={matchLabel}
        draggable={false}
        data-navigation-ignore
        onClick={(event) => {
          if (swiperClickState.allowClick !== false) {
            startNavigation(href);
            return;
          }

          event.preventDefault();
          event.stopPropagation();
        }}
        className="absolute inset-0 z-10 rounded-xl"
      />

      <div className="pointer-events-none relative z-20 flex h-full min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-[var(--ui-muted)]">
          <span className="flex min-w-0 items-center gap-1.5">
            <Image
              src={tournamentLogoAsset.src}
              alt=""
              width={18}
              height={18}
              className={tournamentLogoAsset.className}
            />
            <span className="min-w-0 truncate">{tournamentName}</span>
          </span>
          <span className="ml-auto shrink-0 font-medium opacity-75">{matchDate}</span>
        </div>

        <div className="mt-2.5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <span className="flex min-w-0 items-center justify-end gap-2">
            <b className="min-w-0 truncate text-right text-[15px] font-black">{teamA?.shortName ?? "TBD"}</b>
            <MatchTeamLogo team={teamA} />
          </span>
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#18191c] px-2.5 py-1.5 text-[12px] font-medium tabular-nums text-white transition-opacity group-hover:opacity-80 dark:bg-[#0f1012]"
          >
            {live ? (
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full !bg-[#ff3158]" aria-hidden />
            ) : null}
            {live ? <span className="sr-only">실시간 경기, </span> : null}
            {centerLabel}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <MatchTeamLogo team={teamB} />
            <b className="min-w-0 truncate text-[15px] font-black">{teamB?.shortName ?? "TBD"}</b>
          </span>
        </div>

        <div className="mt-auto pt-2">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium tabular-nums text-[var(--ui-muted)]">
            <span>{market.teamAPercent}%</span>
            <span>{market.teamBPercent}%</span>
          </div>
          <div
            className="flex h-1 overflow-hidden rounded-full bg-[var(--ui-surface)]"
            role="img"
            aria-label={`승부예측 ${teamA?.shortName ?? "TBD"} ${market.teamAPercent}%, ${teamB?.shortName ?? "TBD"} ${market.teamBPercent}%`}
          >
            <span
              style={{
                width: `${market.teamAPercent}%`,
                background: teamA?.primaryColor || "var(--ui-ink)",
              }}
            />
            <span
              className="flex-1"
              style={{ background: teamB?.primaryColor || "var(--ui-muted)" }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
