"use client";

import { useState } from "react";
import type { PredictionBet } from "@/lib/predictions";

/** Apply authoritative action results without waiting for a second page read. */
export function usePredictionMarket(bets: PredictionBet[], balance: number | null, userId?: string) {
  const [local, setLocal] = useState<{ source: PredictionBet[]; bets: PredictionBet[]; balance: number } | null>(null);
  const currentBets = local?.source === bets ? local.bets : bets;
  const currentBalance = local?.source === bets ? local.balance : balance;
  return {
    bets: currentBets, balance: currentBalance,
    placed(matchId: string, teamId: string, stake: number, result: { betId?: string; balance: number }) {
      if (!userId || !result.betId) return;
      setLocal({ source: bets, balance: result.balance, bets: [...currentBets.filter(bet => bet.userId !== userId || bet.matchId !== matchId), { id: result.betId, userId, matchId, teamId, stake, status: "open" }] });
    },
    cancelled(matchId: string, result: { balance: number }) {
      setLocal({ source: bets, balance: result.balance, bets: currentBets.filter(bet => bet.userId !== userId || bet.matchId !== matchId) });
    },
  };
}
