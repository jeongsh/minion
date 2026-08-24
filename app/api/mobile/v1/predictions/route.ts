import type { MobilePredictionsDto } from "@/packages/contracts/src/mobile-v1";
import { getAllTeams, getMatches } from "@/lib/data/lck";
import { mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";
import { getPredictionMarketData, predictionMarketForMatch } from "@/lib/predictions";

export const revalidate = 30;

export async function GET() {
  const [matches, teams, market] = await Promise.all([getMatches(), getAllTeams(), getPredictionMarketData()]);
  const teamMap = new Map(teams.map((team) => [team.id, team]));

  const now = Date.now();
  const windowStart = now - 1000 * 60 * 60 * 24 * 7;
  const windowEnd = now + 1000 * 60 * 60 * 24 * 21;
  const visibleMatches = matches.filter((match) => {
    const matchTime = new Date(match.matchDate).getTime();
    return matchTime >= windowStart && matchTime <= windowEnd && match.teamAId && match.teamBId;
  });

  const data: MobilePredictionsDto = {
    matches: visibleMatches
      .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
      .map((match) => {
        const matchBets = market.bets.filter((bet) => bet.matchId === match.id && bet.status === "open");
        const marketData = predictionMarketForMatch(matchBets, match.id, match.teamAId, match.teamBId);
        return {
          closed: new Date(match.matchDate).getTime() <= now || match.status !== "scheduled",
          id: match.id,
          market: { teamAOdds: marketData.teamAOdds, teamAPercent: marketData.teamAPercent, teamBOdds: marketData.teamBOdds, teamBPercent: marketData.teamBPercent },
          startsAt: match.matchDate,
          status: match.status,
          teamA: teamMap.get(match.teamAId) ? toMobileTeam(teamMap.get(match.teamAId)!) : null,
          teamB: teamMap.get(match.teamBId) ? toMobileTeam(teamMap.get(match.teamBId)!) : null,
          tournamentId: match.tournamentId,
        };
      }),
    now,
  };

  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } });
}
