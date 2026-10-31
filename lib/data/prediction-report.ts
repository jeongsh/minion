import "server-only";

import { getVerifiedAuth } from "@/lib/auth/verified-user";
import { getAllTeams } from "@/lib/data/lck";
import type { PredictionRecord, ReportTeam } from "@/lib/prediction-report";

type BetRow = {
  id: string;
  match_id: string;
  team_id: string;
  stake: number;
  payout: number;
  status: PredictionRecord["status"];
  settled_at: string | null;
  match: {
    match_date: string;
    tournament_id: string;
    team_a_id: string;
    team_b_id: string;
    team_a_score: number | null;
    team_b_score: number | null;
    tournament: { name: string; season: number } | null;
  } | null;
};

/** Authenticated ownership is derived on the server, never supplied by the browser. */
export async function getMyPredictionReport() {
  const auth = await getVerifiedAuth();
  if (!auth) return null;

  const { supabase, user } = auth;
  async function readBets() {
    const rows: BetRow[] = [];
    const snapshot = new Date().toISOString();
    // Read every page; the Data API's row limit must not truncate lifetime stats.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("prediction_bets")
        .select("id, match_id, team_id, stake, payout, status, settled_at, match:matches!match_id(match_date, tournament_id, team_a_id, team_b_id, team_a_score, team_b_score, tournament:tournaments!tournament_id(name, season))")
        .eq("user_id", user.id)
        .lte("created_at", snapshot)
        .order("id", { ascending: true })
        .range(offset, offset + 499)
        .returns<BetRow[]>();
      if (error) throw new Error("예측 기록을 불러오지 못했습니다.", { cause: error });
      rows.push(...(data ?? []));
      if (!data || data.length < 500) return rows;
    }
  }

  const [rows, allTeams] = await Promise.all([readBets(), getAllTeams()]);
  const records: PredictionRecord[] = rows.map((row) => {
    if (!row.match) throw new Error("예측에 연결된 경기 정보를 불러오지 못했습니다.");
    return {
      id: row.id, matchId: row.match_id, teamId: row.team_id,
      stake: Number(row.stake), payout: Number(row.payout), status: row.status, settledAt: row.settled_at,
      matchDate: row.match.match_date, tournamentId: row.match.tournament_id,
      tournamentName: row.match.tournament ? `${row.match.tournament.season} ${row.match.tournament.name}` : "대회 미정",
      teamAId: row.match.team_a_id, teamBId: row.match.team_b_id,
      teamAScore: row.match.team_a_score, teamBScore: row.match.team_b_score,
    };
  });
  const usedTeams = new Set(records.flatMap((record) => [record.teamAId, record.teamBId, record.teamId]));
  const teams: ReportTeam[] = allTeams.filter((team) => usedTeams.has(team.id)).map(({ id, name, slug, shortName, logoUrl, logoWhiteUrl, useWhiteLogoOnDark }) => ({ id, name, slug, shortName, logoUrl, logoWhiteUrl, useWhiteLogoOnDark }));
  return { records, teams };
}
