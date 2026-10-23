import "server-only";
import type { Match, PlayerStatLine, SetResult, Team } from "../types.ts";
import { briefingTeamsNeedingData, type LeaguepediaBriefingRows } from "../match-briefing-data.ts";
import { fillMissingTeamRegions, storeTeamBriefingSource } from "../sync/team-briefing-source.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

const SOURCE_STALE_MS = 12 * 60 * 60 * 1_000;
const UPCOMING_WINDOW_MS = 14 * 24 * 60 * 60 * 1_000;

export type TeamBriefingSourceRefreshSummary = {
  candidates: number;
  refreshed: Array<{ teamId: string; page: string; sets: number }>;
  failed: Array<{ teamId: string; error: string }>;
};

function teamPage(team: Team | undefined) {
  return team?.leaguepediaPage || team?.sourceTeamId?.replace(/^lp:/, "") || null;
}

/** 미리 수집한 팀별 원본. 행이 없는 팀은 결과에서 빠진다. */
export async function getTeamBriefingSourceRows(teamIds: string[]) {
  const result = new Map<string, LeaguepediaBriefingRows>();
  if (!teamIds.length) return result;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("team_briefing_sources").select("team_id,rows").in("team_id", teamIds);
  if (error) throw new Error(`팀 브리핑 원본 조회 실패: ${error.message}`);
  for (const row of data ?? []) result.set(row.team_id as string, row.rows as LeaguepediaBriefingRows);
  return result;
}

/**
 * 2주 안에 경기가 잡힌 팀 중 로컬 기록만으로 최근 세트가 부족한 팀의
 * Leaguepedia 최근 경기를 BRIEFING_MIN_SETS 이상 미리 저장한다.
 * Leaguepedia 요청 간격이 길어 한 번에 maxTeams개 팀만 오래된 순으로 갱신한다.
 */
export async function refreshTeamBriefingSources({ teams, matches, sets, playerStats, maxTeams = 2, force = false }: {
  teams: Team[];
  matches: Match[];
  sets: SetResult[];
  playerStats: PlayerStatLine[];
  maxTeams?: number;
  force?: boolean;
}): Promise<TeamBriefingSourceRefreshSummary> {
  const now = Date.now();
  const upcoming = matches.filter((match) => match.status !== "completed"
    && Date.parse(match.matchDate) > now - 6 * 60 * 60 * 1_000 && Date.parse(match.matchDate) < now + UPCOMING_WINDOW_MS
    && teams.some((team) => team.id === match.teamAId) && teams.some((team) => team.id === match.teamBId));
  const needing = new Set<string>();
  for (const match of upcoming) {
    for (const id of briefingTeamsNeedingData(match, { matches, sets, playerStats })) needing.add(id);
  }
  const candidates = [...needing].filter((id) => teamPage(teams.find((team) => team.id === id)));
  const admin = createSupabaseAdminClient();
  const { data: existing, error } = await admin.from("team_briefing_sources").select("team_id,fetched_at").in("team_id", candidates);
  if (error) throw new Error(`팀 브리핑 원본 상태 조회 실패: ${error.message}`);
  const fetchedAt = new Map((existing ?? []).map((row) => [row.team_id as string, Date.parse(row.fetched_at as string)]));
  const due = candidates
    .filter((id) => force || !fetchedAt.has(id) || now - fetchedAt.get(id)! >= SOURCE_STALE_MS)
    .sort((a, b) => (fetchedAt.get(a) ?? 0) - (fetchedAt.get(b) ?? 0))
    .slice(0, Math.max(0, maxTeams));
  const summary: TeamBriefingSourceRefreshSummary = { candidates: candidates.length, refreshed: [], failed: [] };
  for (const teamId of due) {
    const page = teamPage(teams.find((team) => team.id === teamId))!;
    try {
      const { sets: count } = await storeTeamBriefingSource(admin, teamId, page);
      summary.refreshed.push({ teamId, page, sets: count });
    } catch (refreshError) {
      summary.failed.push({ teamId, error: refreshError instanceof Error ? refreshError.message : String(refreshError) });
    }
  }
  if (summary.refreshed.length) {
    try {
      await fillMissingTeamRegions(admin);
    } catch (regionError) {
      summary.failed.push({ teamId: "region", error: regionError instanceof Error ? regionError.message : String(regionError) });
    }
  }
  return summary;
}
