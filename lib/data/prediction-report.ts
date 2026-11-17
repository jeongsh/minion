import "server-only";

import { getVerifiedAuth } from "@/lib/auth/verified-user";
import { getAllTeams } from "@/lib/data/lck";
import { buildPredictionReport, type ReportPeriod, type PredictionRecord, type ReportTeam } from "@/lib/prediction-report";
import { collectCountedKeysetPages } from "@/lib/data/paged-read";

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
export async function getMyPredictionReport(input: { period?: string; tournament?: string; status?: string; page?: string } = {}) {
  const auth = await getVerifiedAuth();
  if (!auth) return null;

  const { supabase, user } = auth;
  const period: ReportPeriod = input.period === "30" || input.period === "90" ? input.period : "all";
  const requestedTournament = input.tournament ?? "all";
  const tournamentId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedTournament) ? requestedTournament : "all";
  const status = ["open", "won", "lost", "refunded"].includes(input.status ?? "") ? input.status! : "all";
  const now = Date.now();
  const end = (Math.floor((now + 9 * 3_600_000) / 86_400_000) + 1) * 86_400_000 - 9 * 3_600_000;
  const columns = "id, match_id, team_id, stake, payout, status, settled_at, match:matches!match_id!inner(match_date, tournament_id, team_a_id, team_b_id, team_a_score, team_b_score, tournament:tournaments!tournament_id(name, season))";
  const snapshot = new Date().toISOString();
  const scoped = (withCount = false) => {
    let query = supabase.from("prediction_bets").select(columns, withCount ? { count: "exact" } : {})
      .eq("user_id", user.id).lte("created_at", snapshot);
    if (tournamentId !== "all") query = query.eq("match.tournament_id", tournamentId);
    if (period !== "all") query = query.gte("match.match_date", new Date(end - Number(period) * 86_400_000).toISOString()).lt("match.match_date", new Date(end).toISOString());
    return query;
  };
  async function readBets() {
    return collectCountedKeysetPages<BetRow>(async after => {
      let query = scoped(true).order("id", { ascending: true }).limit(500);
      if (after) query = query.gt("id", after);
      const { data, error, count } = await query.returns<BetRow[]>();
      if (error) throw new Error("예측 기록을 불러오지 못했습니다.", { cause: error });
      return { rows: data ?? [], count };
    });
  }

  const [rows, allTeams, options, existence] = await Promise.all([
    readBets(), getAllTeams(), supabase.rpc("read_prediction_report_tournaments"),
    supabase.from("prediction_bets").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  if (options.error) throw options.error;
  if (existence.error) throw existence.error;
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
  const requestedPage = Math.max(1, Math.min(100_000, Math.floor(Number(input.page) || 1)));
  let historyQuery = scoped(true).order("match(match_date)", { ascending: false }).order("id", { ascending: false });
  if (status !== "all") historyQuery = historyQuery.eq("status", status);
  let historyResult = await historyQuery.range((requestedPage - 1) * 12, requestedPage * 12 - 1);
  if (historyResult.error && historyResult.error.code !== "PGRST103") throw historyResult.error;
  const totalCount = historyResult.count ?? records.filter(row => status === "all" || row.status === status).length;
  const totalPages = Math.max(1, Math.ceil(totalCount / 12));
  const page = Math.min(requestedPage, totalPages);
  if (page !== requestedPage) historyResult = await historyQuery.range((page - 1) * 12, page * 12 - 1);
  if (historyResult.error) throw historyResult.error;
  const recordById = new Map(records.map(record => [record.id, record]));
  const history = (historyResult.data ?? []).map(row => {
    const record = recordById.get(row.id);
    if (!record) throw new Error("예측 기록이 변경되었습니다. 다시 시도해 주세요.");
    return record;
  });
  const tournaments = [{ value: "all", label: "모든 대회" }, ...((options.data ?? []) as { id: string; name: string; season: number }[])
    .map(row => ({ value: row.id, label: `${row.season} ${row.name}` })).sort((a, b) => b.label.localeCompare(a.label))];
  return { report: buildPredictionReport(records), history, teams, tournaments, period, tournamentId, status, page, totalPages, totalCount, hasRecords: Boolean(existence.count) };
}
