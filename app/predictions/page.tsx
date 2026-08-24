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
    <main className="text-[var(--ui-text)]">
      <div className="layout-wide pt-6 sm:pt-8 xl:px-10">
        <h1 className="sr-only">승부예측</h1>
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
