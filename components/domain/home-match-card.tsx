"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { TeamLogo } from "@/components/ui/team-logo";
import { usePredictionBetDialog } from "@/components/domain/prediction-bet-dialog";
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
  currentUserId,
  balance,
}: HomeMatchItem & { currentUserId?: string; balance: number | null }) {
  const { open, pending, modal } = usePredictionBetDialog({ currentUserId, balance, bets });
  const market = predictionMarketForMatch(bets, match.id, match.teamAId, match.teamBId);
  const live = isMatchLive(match);
  // status만 보면 경기 시작 시각이 지났는데도 동기화 지연으로 scheduled가 남아있는 동안
  // 예측이 열려있는 것처럼 보인다. 승부예측 탭과 동일하게 시작 시각도 함께 본다.
  // eslint-disable-next-line react-hooks/purity
  const bettingClosed = match.status !== "scheduled" || new Date(match.matchDate).getTime() <= Date.now();
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

  return (
    <>
      <article className="flex h-full min-h-[100px] min-w-0 flex-col rounded-xl bg-[var(--home-card-bg-strong)] p-3 transition-colors hover:bg-[var(--home-card-bg-hover)]">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-[var(--ui-muted)]">
          <Link href={matchHref(match)} className="flex min-w-0 items-center gap-1.5">
            <Image
              src={tournamentLogoAsset.src}
              alt=""
              width={18}
              height={18}
              className={tournamentLogoAsset.className}
            />
            <span className="min-w-0 truncate">{tournamentName}</span>
          </Link>
          <span className="ml-auto shrink-0 font-medium opacity-75">{matchDate}</span>
        </div>

        <div className="mt-2.5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          {bettingClosed ? (
            <Link
              href={matchHref(match)}
              className="flex min-w-0 items-center justify-end gap-2 transition-colors hover:text-[var(--match-team-color)]"
              style={{ "--match-team-color": teamA?.primaryColor || "var(--ui-ink)" } as CSSProperties}
            >
              <b className="min-w-0 truncate text-right text-[15px] font-black">{teamA?.shortName ?? "TBD"}</b>
              <MatchTeamLogo team={teamA} />
            </Link>
          ) : (
            <button
              type="button"
              disabled={!teamA || pending}
              onClick={() => teamA && open(match.id, teamA.id, teamA.shortName)}
              className="flex min-w-0 items-center justify-end gap-2 transition-colors hover:text-[var(--match-team-color)] disabled:opacity-50"
              style={{ "--match-team-color": teamA?.primaryColor || "var(--ui-ink)" } as CSSProperties}
              aria-label={`${teamA?.shortName ?? "TBD"} 승리 예측`}
            >
              <b className="min-w-0 truncate text-right text-[15px] font-black">{teamA?.shortName ?? "TBD"}</b>
              <MatchTeamLogo team={teamA} />
            </button>
          )}
          <Link
            href={matchHref(match)}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--ui-ink)] px-2.5 py-1.5 text-[12px] font-black tabular-nums text-[var(--ui-surface)] transition-opacity hover:opacity-80"
          >
            {live ? (
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#ff3158]" aria-hidden />
            ) : null}
            {live ? <span className="sr-only">실시간 경기, </span> : null}
            {centerLabel}
          </Link>
          {bettingClosed ? (
            <Link
              href={matchHref(match)}
              className="flex min-w-0 items-center gap-2 transition-colors hover:text-[var(--match-team-color)]"
              style={{ "--match-team-color": teamB?.primaryColor || "var(--ui-ink)" } as CSSProperties}
            >
              <MatchTeamLogo team={teamB} />
              <b className="min-w-0 truncate text-[15px] font-black">{teamB?.shortName ?? "TBD"}</b>
            </Link>
          ) : (
            <button
              type="button"
              disabled={!teamB || pending}
              onClick={() => teamB && open(match.id, teamB.id, teamB.shortName)}
              className="flex min-w-0 items-center gap-2 transition-colors hover:text-[var(--match-team-color)] disabled:opacity-50"
              style={{ "--match-team-color": teamB?.primaryColor || "var(--ui-ink)" } as CSSProperties}
              aria-label={`${teamB?.shortName ?? "TBD"} 승리 예측`}
            >
              <MatchTeamLogo team={teamB} />
              <b className="min-w-0 truncate text-[15px] font-black">{teamB?.shortName ?? "TBD"}</b>
            </button>
          )}
        </div>

        <div className="mt-auto pt-2">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold tabular-nums text-[var(--ui-muted)]">
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
      </article>
      {modal}
    </>
  );
}
