import Link from "next/link";

import { TeamLogo } from "@/components/ui/team-logo";
import { predictionMarketForMatch, type PredictionBet } from "@/lib/predictions";
import type { Match, Team } from "@/lib/types";

function oddsLabel(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}배`;
}

export function PredictionMarketLine({ match, teams, bets, compact = false }: { match: Match; teams: Team[] | Map<string, Team>; bets: PredictionBet[]; compact?: boolean }) {
  const teamMap = teams instanceof Map ? teams : new Map(teams.map((team) => [team.id, team]));
  const teamA = teamMap.get(match.teamAId);
  const teamB = teamMap.get(match.teamBId);
  const market = predictionMarketForMatch(bets, match.id, match.teamAId, match.teamBId);

  return (
    <Link href="/predictions" className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] transition hover:border-[var(--ui-ink)] ${compact ? "h-14 px-3" : "h-[76px] px-4"}`}>
      <div className="flex min-w-0 items-center gap-2">
        <TeamLogo team={teamA} size={compact ? "h-7 w-7" : "h-9 w-9"} plain themeAware />
        <span className="flex min-w-0 items-center gap-1.5"><span className="truncate text-sm font-black text-[var(--ui-ink)]">{teamA?.shortName ?? "TBD"}</span><small className="shrink-0 text-[11px] font-bold text-[var(--ui-muted)]">{oddsLabel(market.teamAOdds)}</small></span>
        <strong className={`ml-auto whitespace-nowrap ${compact ? "text-lg" : "text-2xl"}`}>{market.teamAPercent}%</strong>
      </div>
      <span className="px-3 text-xs font-black text-[var(--ui-muted)]">VS</span>
      <div className="flex min-w-0 flex-row-reverse items-center gap-2 text-right">
        <TeamLogo team={teamB} size={compact ? "h-7 w-7" : "h-9 w-9"} plain themeAware />
        <span className="flex min-w-0 flex-row-reverse items-center gap-1.5"><span className="truncate text-sm font-black text-[var(--ui-ink)]">{teamB?.shortName ?? "TBD"}</span><small className="shrink-0 text-[11px] font-bold text-[var(--ui-muted)]">{oddsLabel(market.teamBOdds)}</small></span>
        <strong className={`mr-auto whitespace-nowrap ${compact ? "text-lg" : "text-2xl"}`}>{market.teamBPercent}%</strong>
      </div>
    </Link>
  );
}
