import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PredictionBet = {
  id: string;
  userId: string;
  matchId: string;
  teamId: string;
  stake: number;
  /** 정산 지급액. 적중이면 원금 포함 지급액, 환불이면 원금, 그 외에는 0이다. */
  payout?: number;
  status: "open" | "won" | "lost" | "refunded";
};

export type PredictionRanking = {
  userId: string;
  nickname: string;
  balance: number;
  profit: number;
  betCount: number;
  winCount: number;
  rank: number;
};

export function predictionMaxStake(balance: number) {
  return Math.min(5_000, Math.max(100, Math.floor((Math.max(0, balance) * 0.2) / 100) * 100));
}

export type PredictionMarketAggregate = { matchId: string; teamId: string; status: PredictionBet["status"]; stake: number };

export function predictionMarketForMatch(bets: PredictionBet[], matchId: string, teamAId: string, teamBId: string, includeRefunded = false, markets?: PredictionMarketAggregate[], baseline: PredictionBet[] = bets) {
  const marketBets = bets.filter(
    (bet) => bet.matchId === matchId && (includeRefunded || bet.status !== "refunded"),
  );
  const sum = (rows: Pick<PredictionBet, "matchId" | "teamId" | "stake" | "status">[], teamId: string) => rows
    .filter(row => row.matchId === matchId && row.teamId === teamId && (includeRefunded || row.status !== "refunded"))
    .reduce((total, row) => total + row.stake, 0);
  const totalFor = (teamId: string) => markets
    ? Math.max(0, sum(markets, teamId) - sum(baseline, teamId) + sum(marketBets, teamId))
    : sum(marketBets, teamId);
  const teamAStake = totalFor(teamAId);
  const teamBStake = totalFor(teamBId);
  const totalStake = teamAStake + teamBStake;
  const teamAPercent = totalStake > 0 ? Math.round((teamAStake / totalStake) * 100) : 50;
  return {
    teamAStake,
    teamBStake,
    totalStake,
    teamAPercent,
    teamBPercent: 100 - teamAPercent,
    teamAOdds: teamAStake > 0 ? totalStake / teamAStake : null,
    teamBOdds: teamBStake > 0 ? totalStake / teamBStake : null,
  };
}

// matchId 를 넘기면 그 경기 베팅만 조회하고 전체 랭킹은 건너뛴다(매치 상세/모바일 매치
// 라우트는 해당 경기 시장 정보만 쓴다). matchIds 를 넘기면 그 경기들 베팅만 조회한다
// (승부예측 화면은 노출되는 시간 창 안의 경기만 필요). 대상이 없으면 베팅을 조회하지 않는다.
export const getPredictionMarketData = cache(async function getPredictionMarketData(
  userId?: string,
  matchId?: string,
  matchIds?: string[],
  includeRankings = true,
) {
  const supabase = createSupabaseServerClient();
  let betsQuery = supabase
    .from("prediction_bets")
    .select("id, user_id, match_id, team_id, stake, payout, status");
  if (userId) betsQuery = betsQuery.eq("user_id", userId);
  const ids = matchId ? [matchId] : matchIds ?? [];
  if (matchId) betsQuery = betsQuery.eq("match_id", matchId);
  else if (matchIds) betsQuery = betsQuery.in("match_id", matchIds);

  const [betsResult, rankingsResult, walletResult, marketsResult] = await Promise.all([
    !userId || ids.length === 0 ? Promise.resolve({ data: [], error: null }) : betsQuery,
    matchId || !includeRankings
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("prediction_rankings")
          .select("user_id, nickname, balance, profit, bet_count, win_count, rank")
          .order("rank", { ascending: true })
          .limit(10),
    userId
      ? supabase.from("profiles").select("lp").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ids.length ? supabase.rpc("read_prediction_markets", { p_match_ids: ids }) : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [betsResult, rankingsResult, walletResult, marketsResult]) if (result.error) throw result.error;
  const markets: PredictionMarketAggregate[] = (marketsResult.data ?? []).map((row: { match_id: string; team_id: string; status: PredictionBet["status"]; stake: number }) => ({ matchId: row.match_id, teamId: row.team_id, status: row.status, stake: Number(row.stake) }));
  const bets: PredictionBet[] = (betsResult.data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    matchId: row.match_id,
    teamId: row.team_id,
    stake: Number(row.stake),
    payout: Number(row.payout ?? 0),
    status: row.status,
  }));
  const rankings: PredictionRanking[] = (rankingsResult.data ?? []).map((row) => ({
    userId: row.user_id,
    nickname: row.nickname,
    balance: Number(row.balance),
    profit: Number(row.profit),
    betCount: Number(row.bet_count),
    winCount: Number(row.win_count),
    rank: Number(row.rank),
  }));

  return {
    bets,
    markets,
    rankings,
    balance: userId ? Number(walletResult.data?.lp ?? 10_000) : null,
  };
});
