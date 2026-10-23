import "server-only";
import type { Match, Player, Team } from "../types.ts";
import { briefingTeamsNeedingData, mergeLeaguepediaBriefingData, restoreMatchBriefingData, type BriefingData, type LeaguepediaBriefingRows, type MatchBriefingSnapshot } from "../match-briefing-data.ts";
import { storeTeamBriefingSource } from "../sync/team-briefing-source.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";
import { getTeamBriefingSourceRows } from "./team-briefing-sources.ts";

const inFlight = new Map<string, ReturnType<typeof storeTeamBriefingSource>>();

/** 생성 작업 전용. 조회 화면은 getStoredMatchBriefingData만 사용한다. */
export async function supplementMatchBriefingData(match: Match, teams: Team[], players: Player[], data: BriefingData) {
  let result = data;
  const briefingRows: LeaguepediaBriefingRows[] = [];
  // 크론이 미리 저장한 최근 세트를 먼저 쓰고, 그래도 부족한 팀만 직접 조회한다.
  const stored = await getTeamBriefingSourceRows(briefingTeamsNeedingData(match, result));
  for (const rows of stored.values()) {
    briefingRows.push(rows);
    result = mergeLeaguepediaBriefingData(match, result, rows, teams, players);
  }
  for (const id of briefingTeamsNeedingData(match, result)) {
    const team = teams.find((item) => item.id === id);
    const page = team?.leaguepediaPage ?? team?.sourceTeamId?.replace(/^lp:/, "");
    if (!page) continue;
    const cutoff = new Date(Math.min(Date.parse(match.matchDate), Date.now())).toISOString();
    // 예정 경기들은 같은 팀의 최신 수집과 DB 저장 작업을 공유한다.
    const key = `${id}:${Date.parse(match.matchDate) > Date.now() ? "upcoming" : cutoff}`;
    let promise = inFlight.get(key);
    if (!promise) {
      promise = storeTeamBriefingSource(createSupabaseAdminClient(), id, page, { cutoff });
      inFlight.set(key, promise);
    }
    try {
      // 저장 실패는 생성 호출로 전파한다. DB에 없는 새 자료로 프리뷰를 만들지 않는다.
      const { rows } = await promise;
      briefingRows.push(rows);
      result = mergeLeaguepediaBriefingData(match, result, rows, teams, players);
    } finally {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    }
  }
  return { ...result, briefingRows };
}

/** 저장된 프리뷰와 팀 원본만 읽는다. 외부 조회를 시작하지 않는다. */
export async function getStoredMatchBriefingData(match: Match, teams: Team[], players: Player[], data: BriefingData) {
  const admin = createSupabaseAdminClient();
  const { data: cached, error } = await admin.from("match_ai_previews").select("content").eq("match_id", match.id).maybeSingle();
  if (error) throw new Error(`매치 브리핑 기록 조회 실패: ${error.message}`);
  let result = restoreMatchBriefingData(match, teams, players, data, cached?.content?.briefingData as MatchBriefingSnapshot | undefined);
  // 프리뷰 생성 이후 수집된 지표도 반영한다. 병합 함수가 경기 시작 이후 기록을 제외한다.
  const sources = await getTeamBriefingSourceRows([match.teamAId, match.teamBId]);
  for (const rows of sources.values()) {
    result = { ...result, ...mergeLeaguepediaBriefingData(match, result, rows, teams, players) };
  }
  return result;
}
