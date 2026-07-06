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

export async function getPredictionMarketData(userId?: string) {
  const supabase = createSupabaseServerClient();
  const [betsResult, rankingsResult, walletResult] = await Promise.all([
    supabase
      .from("prediction_bets")
      .select("id, user_id, match_id, team_id, stake, status"),
    supabase
      .from("prediction_rankings")
      .select("user_id, nickname, balance, profit, bet_count, win_count, rank")
      .order("rank", { ascending: true })
      .limit(10),
    userId
      ? supabase.from("prediction_wallets").select("balance").eq("user_id", userId).maybeSingle()
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
    balance: userId ? Number(walletResult.data?.balance ?? 10_000) : null,
  };
}
