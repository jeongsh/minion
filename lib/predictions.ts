import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PredictionBet = {
  id: string;
  userId: string;
  matchId: string;
  teamId: string;
  stake: number;
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

export function predictionMarketForMatch(bets: PredictionBet[], matchId: string, teamAId: string, teamBId: string) {
  const marketBets = bets.filter(
    (bet) => bet.matchId === matchId && bet.status !== "refunded",
  );
  const teamAStake = marketBets
    .filter((bet) => bet.teamId === teamAId)
    .reduce((sum, bet) => sum + bet.stake, 0);
  const teamBStake = marketBets
    .filter((bet) => bet.teamId === teamBId)
    .reduce((sum, bet) => sum + bet.stake, 0);
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
// (승부예측 화면은 노출되는 시간 창 안의 경기만 필요). 둘 다 미지정 시 전체 베팅을 조회한다.
export const getPredictionMarketData = cache(async function getPredictionMarketData(
  userId?: string,
  matchId?: string,
  matchIds?: string[],
) {
  const supabase = createSupabaseServerClient();
  let betsQuery = supabase
    .from("prediction_bets")
    .select("id, user_id, match_id, team_id, stake, status");
  if (matchId) betsQuery = betsQuery.eq("match_id", matchId);
  else if (matchIds) betsQuery = betsQuery.in("match_id", matchIds);

  const [betsResult, rankingsResult, walletResult] = await Promise.all([
    betsQuery,
    matchId
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("prediction_rankings")
          .select("user_id, nickname, balance, profit, bet_count, win_count, rank")
          .order("rank", { ascending: true })
          .limit(10),
    userId
      ? supabase.from("profiles").select("lp").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const bets: PredictionBet[] = (betsResult.data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    matchId: row.match_id,
    teamId: row.team_id,
    stake: Number(row.stake),
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
    rankings,
    balance: userId ? Number(walletResult.data?.lp ?? 10_000) : null,
  };
});
