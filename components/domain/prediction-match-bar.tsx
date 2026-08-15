"use client";

import type { CSSProperties } from "react";

import { TeamLogo } from "@/components/ui/team-logo";
import { usePredictionBetDialog } from "@/components/domain/prediction-bet-dialog";
import { predictionMarketForMatch, type PredictionBet } from "@/lib/predictions";
import type { Match, Team } from "@/lib/types";

function teamColor(team: Team | undefined) {
  const color = team?.primaryColor;
  return color && /^#[\da-f]{6}$/i.test(color) ? color : "#3b3f46";
}

function TeamChoice({
  team,
  percent,
  odds,
  selected,
  disabled,
  onClick,
  right = false,
}: {
  team?: Team;
  percent: number;
  odds: number | null;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  right?: boolean;
}) {
  const color = teamColor(team);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !team}
      className={`prediction-match-choice ${
        right ? "prediction-match-choice--right" : "prediction-match-choice--left"
      } relative flex min-w-0 items-center gap-1.5 px-2 py-0 text-left transition active:scale-[0.99] disabled:cursor-default disabled:active:scale-100 sm:gap-3 sm:px-5 xl:gap-3 ${
        right ? "text-right xl:flex-row-reverse" : ""
      }`}
      style={{ "--prediction-choice-color": color } as CSSProperties}
      aria-pressed={selected}
    >
      <span className={`flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3 ${right ? "flex-row-reverse" : ""}`}>
        <TeamLogo team={team} size="h-7 w-7 sm:h-10 sm:w-10" plain themeAware />
        <span className={`flex min-w-0 items-baseline gap-1 ${right ? "flex-row-reverse" : ""}`}>
          <span className="min-w-0 truncate text-[15px] font-black text-[var(--ui-ink)] sm:text-xl">
            {team?.shortName ?? "TBD"}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-[var(--ui-muted)] sm:text-[13px]">
            {odds === null ? "1.00" : odds.toFixed(2)}
            <span className="text-[10px] sm:text-[12px]">{"\u00a0배"}</span>
          </span>
        </span>
      </span>
      <span className="shrink-0 text-[17px] font-black leading-none tabular-nums text-[var(--ui-ink)] sm:text-[26px]">
        {percent}
        <span className="ml-0.5 text-[12px] text-[var(--ui-muted)] sm:text-sm">%</span>
      </span>
    </button>
  );
}

export function PredictionMatchBar({
  match,
  teamA,
  teamB,
  bets,
  currentUserId,
  balance,
  now,
  className = "",
}: {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  bets: PredictionBet[];
  currentUserId?: string;
  balance: number | null;
  now: number;
  className?: string;
}) {
  const { open, pending, modal } = usePredictionBetDialog({ currentUserId, balance, bets });
  const matchBets = bets.filter((item) => item.matchId === match.id && item.status === "open");
  const myBet = currentUserId ? matchBets.find((item) => item.userId === currentUserId) : undefined;
  const myVote = myBet?.teamId;
  const market = predictionMarketForMatch(matchBets, match.id, match.teamAId, match.teamBId);
  const closed = match.status !== "scheduled" || new Date(match.matchDate).getTime() <= now;
  const cardStyle = {
    "--prediction-team-left-color": teamColor(teamA),
    "--prediction-team-right-color": teamColor(teamB),
    ...(myVote ? { "--prediction-team-color": teamColor(myVote === match.teamAId ? teamA : teamB) } : {}),
  } as CSSProperties;

  return (
    <>
      <div
        className={`prediction-match-card grid min-h-[76px] grid-cols-[minmax(0,1fr)_34px_minmax(0,1fr)] overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] dark:bg-[var(--ui-surface-muted)] sm:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] xl:h-[76px] ${
          myVote === match.teamAId
            ? "prediction-match-card--selected-left"
            : myVote === match.teamBId
              ? "prediction-match-card--selected-right"
              : ""
        } ${className}`}
        style={cardStyle}
      >
        <TeamChoice
          team={teamA}
          percent={market.teamAPercent}
          odds={market.teamAOdds}
          selected={myVote === match.teamAId}
          disabled={closed || pending}
          onClick={() => teamA && open(match.id, teamA.id, teamA.shortName)}
        />
        <div className="grid place-items-center text-[13px] font-black text-[var(--ui-muted)] sm:text-sm">VS</div>
        <TeamChoice
          team={teamB}
          percent={market.teamBPercent}
          odds={market.teamBOdds}
          selected={myVote === match.teamBId}
          disabled={closed || pending}
          onClick={() => teamB && open(match.id, teamB.id, teamB.shortName)}
          right
        />
      </div>
      {modal}
    </>
  );
}
