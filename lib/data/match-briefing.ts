import "server-only";
import { unstable_cache } from "next/cache";
import type { Match, Player, Team } from "../types.ts";
import { briefingTeamsNeedingData, mergeLeaguepediaBriefingData, restoreMatchBriefingData, type BriefingData, type LeaguepediaBriefingRows, type MatchBriefingSnapshot } from "../match-briefing-data.ts";
import { fetchLeaguepediaBriefingRows } from "../sync/leaguepedia-briefing.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

const getRows = unstable_cache(fetchLeaguepediaBriefingRows, ["leaguepedia-briefing-v1"], { revalidate: 3600 });
const inFlight = new Map<string, ReturnType<typeof getRows>>();
const retryAfter = new Map<string, number>();

/** 생성 작업 전용. 조회 화면은 getStoredMatchBriefingData만 사용한다. */
export async function supplementMatchBriefingData(match: Match, teams: Team[], players: Player[], data: BriefingData) {
  let result = data;
  const briefingRows: LeaguepediaBriefingRows[] = [];
  for (const id of briefingTeamsNeedingData(match, data)) {
    const team = teams.find((item) => item.id === id);
    const page = team?.leaguepediaPage ?? team?.sourceTeamId?.replace(/^lp:/, "");
    if (!page) continue;
    const key = `${page}:${match.matchDate}`;
    if ((retryAfter.get(key) ?? 0) > Date.now()) continue;
    try {
      let promise = inFlight.get(key);
      if (!promise) {
        promise = getRows(page, match.matchDate);
        inFlight.set(key, promise);
      }
      const rows = await promise;
      briefingRows.push(rows);
      result = mergeLeaguepediaBriefingData(match, result, rows, teams, players);
    } catch (error) {
      retryAfter.set(key, Date.now() + 5 * 60_000);
      console.warn(`[match-briefing] ${page} 최근 경기 보충 실패`, error);
    } finally {
      inFlight.delete(key);
    }
  }
  return { ...result, briefingRows };
}

/** 저장된 프리뷰 자료만 읽는다. 미생성/구버전 프리뷰도 외부 조회를 시작하지 않는다. */
export async function getStoredMatchBriefingData(match: Match, teams: Team[], players: Player[], data: BriefingData) {
  const admin = createSupabaseAdminClient();
  const { data: cached, error } = await admin.from("match_ai_previews").select("content").eq("match_id", match.id).maybeSingle();
  if (error) throw new Error(`매치 브리핑 기록 조회 실패: ${error.message}`);
  return restoreMatchBriefingData(match, teams, players, data, cached?.content?.briefingData as MatchBriefingSnapshot | undefined);
}
