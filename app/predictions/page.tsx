import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getAllTeams, getMatchesInRange, getTournaments } from "@/lib/data/lck";
import { getPredictionMarketData } from "@/lib/predictions";

import { PredictionBoard } from "./prediction-board";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "승부예측 | MINION",
  description: "LCK 경기 승부를 예측하고 LP를 획득하세요.",
};

export default async function PredictionsPage() {
  const user = await getCurrentUser();

  // Snapshot once per dynamic request; the client receives the same cutoff for every card.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const DAY_MS = 1000 * 60 * 60 * 24;
  const windowStart = now - DAY_MS * 7;
  const windowEnd = now + DAY_MS * 21;
  // DB 조회 범위는 하루 단위로 넉넉히 확장해 unstable_cache 키가 매 요청 달라지지 않게 한다.
  // 정확한 노출 판정은 아래 visibleMatches 필터가 windowStart/windowEnd로 처리한다.
  const rangeStartIso = new Date(Math.floor((windowStart - DAY_MS) / DAY_MS) * DAY_MS).toISOString();
  const rangeEndIso = new Date(Math.ceil((windowEnd + DAY_MS) / DAY_MS) * DAY_MS).toISOString();

  const [matches, teams, tournaments] = await Promise.all([
    getMatchesInRange(rangeStartIso, rangeEndIso),
    getAllTeams(),
    getTournaments(),
  ]);
  const visibleMatches = matches.filter((match) => {
    const matchTime = new Date(match.matchDate).getTime();
    return matchTime >= windowStart && matchTime <= windowEnd && match.teamAId && match.teamBId;
  });
  const market = await getPredictionMarketData(
    user?.id,
    undefined,
    visibleMatches.map((match) => match.id),
  );

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
