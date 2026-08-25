import type { MobilePredictionMutationDto, MobilePredictionsDto } from "@/packages/contracts/src/mobile-v1";
import { getAllTeams, getMatches } from "@/lib/data/lck";
import { mobileError, mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";
import { getPredictionMarketData, predictionMarketForMatch } from "@/lib/predictions";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function predictionError(message: string) {
  if (message.includes("LOGIN_REQUIRED")) return "로그인이 필요합니다.";
  if (message.includes("MIN_STAKE_100")) return "최소 참여 금액은 100 LP입니다.";
  if (message.includes("INSUFFICIENT_SP")) return "보유 LP가 부족합니다.";
  if (message.includes("MAX_STAKE_EXCEEDED")) return "경기당 베팅 한도는 보유 LP의 20%, 최대 5,000 LP입니다.";
  if (message.includes("BET_ALREADY_EXISTS")) return "기존 예측을 취소한 뒤 다시 참여해 주세요.";
  if (message.includes("PREDICTION_CLOSED")) return "이미 마감된 경기입니다.";
  if (message.includes("BET_NOT_FOUND")) return "취소할 예측을 찾을 수 없습니다.";
  return "예측을 처리하지 못했습니다.";
}

async function jsonBody(request: Request) {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const auth = await getMobileAuth(request);
  const [matches, teams, market] = await Promise.all([
    getMatches(),
    getAllTeams(),
    getPredictionMarketData(auth?.user.id),
  ]);
  const teamMap = new Map(teams.map((team) => [team.id, team]));

  const now = Date.now();
  const windowStart = now - 1000 * 60 * 60 * 24 * 7;
  const windowEnd = now + 1000 * 60 * 60 * 24 * 21;
  const visibleMatches = matches.filter((match) => {
    const matchTime = new Date(match.matchDate).getTime();
    return matchTime >= windowStart && matchTime <= windowEnd && match.teamAId && match.teamBId;
  });

  const data: MobilePredictionsDto = {
    balance: market.balance,
    matches: visibleMatches
      .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
      .map((match) => {
        const matchBets = market.bets.filter((bet) => bet.matchId === match.id && bet.status === "open");
        const marketData = predictionMarketForMatch(matchBets, match.id, match.teamAId, match.teamBId);
        const myBet = auth ? matchBets.find((bet) => bet.userId === auth.user.id) : null;
        return {
          closed: new Date(match.matchDate).getTime() <= now || match.status !== "scheduled",
          id: match.id,
          market: { teamAOdds: marketData.teamAOdds, teamAPercent: marketData.teamAPercent, teamBOdds: marketData.teamBOdds, teamBPercent: marketData.teamBPercent },
          myBet: myBet ? { id: myBet.id, matchId: myBet.matchId, stake: myBet.stake, teamId: myBet.teamId } : null,
          startsAt: match.matchDate,
          status: match.status,
          teamA: teamMap.get(match.teamAId) ? toMobileTeam(teamMap.get(match.teamAId)!) : null,
          teamB: teamMap.get(match.teamBId) ? toMobileTeam(teamMap.get(match.teamBId)!) : null,
          tournamentId: match.tournamentId,
        };
      }),
    now,
  };

  return mobileSuccess(data, { headers: { "Cache-Control": auth ? "private, no-store" : "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } });
}

export async function POST(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);

  const body = await jsonBody(request);
  const matchId = typeof body?.matchId === "string" ? body.matchId : "";
  const teamId = typeof body?.teamId === "string" ? body.teamId : "";
  const stake = body?.stake;
  if (!UUID_PATTERN.test(matchId) || !UUID_PATTERN.test(teamId) || !Number.isSafeInteger(stake)) {
    return mobileError("BAD_REQUEST", "입력값을 확인해 주세요.", 400);
  }

  const { data, error } = await auth.supabase.rpc("place_prediction_bet", {
    p_match_id: matchId,
    p_team_id: teamId,
    p_stake: stake as number,
  });
  if (error) return mobileError("CONFLICT", predictionError(error.message), 409);

  const result: MobilePredictionMutationDto = { balance: Number(data?.[0]?.balance ?? 0) };
  return mobileSuccess(result, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);

  const body = await jsonBody(request);
  const matchId = typeof body?.matchId === "string" ? body.matchId : "";
  if (!UUID_PATTERN.test(matchId)) return mobileError("BAD_REQUEST", "취소할 경기를 확인해 주세요.", 400);

  const { data, error } = await auth.supabase.rpc("cancel_prediction_bet", { p_match_id: matchId });
  if (error) return mobileError("CONFLICT", predictionError(error.message), 409);

  const result: MobilePredictionMutationDto = { balance: Number(data ?? 0) };
  return mobileSuccess(result, { headers: { "Cache-Control": "private, no-store" } });
}
