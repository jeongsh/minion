import type { Team } from "@/lib/types";

export type ReportTeam = Pick<Team, "id" | "name" | "slug" | "shortName" | "logoUrl" | "logoWhiteUrl" | "useWhiteLogoOnDark">;
export type PredictionRecord = {
  id: string;
  matchId: string;
  matchDate: string;
  tournamentId: string;
  tournamentName: string;
  teamAId: string;
  teamBId: string;
  teamAScore: number | null;
  teamBScore: number | null;
  teamId: string;
  stake: number;
  payout: number;
  status: "open" | "won" | "lost" | "refunded";
  settledAt: string | null;
};

export type ReportPeriod = "all" | "30" | "90";
export const isSettledPrediction = (record: PredictionRecord) => record.status === "won" || record.status === "lost";
export const predictionProfit = (record: PredictionRecord) => isSettledPrediction(record) ? record.payout - record.stake : 0;

/** Periods use Korean match dates, including the whole current day. */
export function filterPredictionRecords(records: PredictionRecord[], period: ReportPeriod, tournamentId: string, now: number) {
  const kstDay = Math.floor((now + 9 * 3_600_000) / 86_400_000);
  const end = (kstDay + 1) * 86_400_000 - 9 * 3_600_000;
  const start = end - Number(period) * 86_400_000;
  return records.filter((record) => (tournamentId === "all" || record.tournamentId === tournamentId)
    && (period === "all" || (Date.parse(record.matchDate) >= start && Date.parse(record.matchDate) < end)));
}

export function buildPredictionReport(records: PredictionRecord[]) {
  const settled = records.filter(isSettledPrediction).sort((a, b) => Date.parse(a.matchDate) - Date.parse(b.matchDate) || a.id.localeCompare(b.id));
  let wins = 0, profit = 0, stake = 0, streak = 0, bestStreak = 0;
  const teams = new Map<string, { teamId: string; count: number; wins: number; profit: number }>();
  const trend = settled.map((record, index) => {
    const won = record.status === "won";
    wins += Number(won);
    profit += predictionProfit(record);
    stake += record.stake;
    streak = won ? Math.max(0, streak) + 1 : Math.min(0, streak) - 1;
    bestStreak = Math.max(bestStreak, streak);
    const team = teams.get(record.teamId) ?? { teamId: record.teamId, count: 0, wins: 0, profit: 0 };
    team.count++;
    team.wins += Number(won);
    team.profit += predictionProfit(record);
    teams.set(record.teamId, team);
    return { id: record.id, date: record.matchDate, profit, accuracy: wins / (index + 1) * 100, count: index + 1, wins };
  });
  const recent = settled.slice(-10);
  return {
    count: records.length,
    settledCount: settled.length,
    wins,
    losses: settled.length - wins,
    accuracy: settled.length ? wins / settled.length * 100 : null,
    profit,
    roi: stake ? profit / stake * 100 : null,
    stake,
    openCount: records.filter((record) => record.status === "open").length,
    openStake: records.filter((record) => record.status === "open").reduce((sum, record) => sum + record.stake, 0),
    refundedCount: records.filter((record) => record.status === "refunded").length,
    streak,
    bestStreak,
    recent,
    recentAccuracy: recent.length ? recent.filter((record) => record.status === "won").length / recent.length * 100 : null,
    trend,
    teams: [...teams.values()].sort((a, b) => b.count - a.count || b.wins - a.wins || a.teamId.localeCompare(b.teamId)),
  };
}

export type PredictionReport = ReturnType<typeof buildPredictionReport>;
