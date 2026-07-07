import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAllTeams, getMatches, getTournaments } from "@/lib/data/lck";
import { getPredictionMarketData } from "@/lib/predictions";

import { PredictionBoard } from "./prediction-board";

export const dynamic = "force-dynamic";

export default async function PredictionsPage() {
  const user = await getCurrentUser();
  const [matches, teams, tournaments, market] = await Promise.all([
    getMatches(),
    getAllTeams(),
    getTournaments(),
    getPredictionMarketData(user?.id),
  ]);
  // Snapshot once per dynamic request; the client receives the same cutoff for every card.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const windowStart = now - 1000 * 60 * 60 * 24 * 7;
  const windowEnd = now + 1000 * 60 * 60 * 24 * 21;
  const visibleMatches = matches.filter((match) => {
    const matchTime = new Date(match.matchDate).getTime();
    return matchTime >= windowStart && matchTime <= windowEnd && match.teamAId && match.teamBId;
  });

  return (
    <main className="min-h-screen bg-[var(--ui-surface)] text-[var(--ui-text)]">
      <div className="mx-auto w-full max-w-[1400px] px-5 pb-20 pt-8 xl:px-10">
        <PageHeader
          eyebrow="MATCH PREDICTION"
          title="승부예측"
          action={
            <span className="rounded-full bg-[var(--ui-surface-muted)] px-3 py-1.5 text-xs font-bold text-[var(--ui-muted)]">
              {visibleMatches.filter((match) => new Date(match.matchDate).getTime() > now).length} OPEN
            </span>
          }
        />
        <PredictionBoard
          matches={visibleMatches}
          teams={teams}
          tournaments={tournaments}
          bets={market.bets}
          currentUserId={user?.id}
          balance={market.balance}
          now={now}
          leaderboard={market.rankings}
        />
      </div>
    </main>
  );
}
