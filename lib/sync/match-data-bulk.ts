import type { SupabaseClient } from "@supabase/supabase-js";

import { syncLeaguepediaMatchSets } from "./leaguepedia-match-sets.ts";
import { syncPomForMatch } from "./sync-pom.ts";
import { syncMatchTimeline } from "./timeline-events.ts";

export type MatchDataBulkSyncSummary = {
  matchesChecked: number;
  matchesProcessed: number;
  matchesSkipped: number;
  setsUpserted: number;
  timelineEventsInserted: number;
  goldFramesInserted: number;
  errors: Array<{ matchId: string; step: "sets" | "timeline" | "pom"; error: string }>;
};

/**
 * 일정 동기화(syncLeaguepediaLck2026)는 매치 스코어/일정만 가져오고, 세트 결과·밴픽·
 * 선수 스탯·타임라인(골드 그래프)·공식 POM은 건드리지 않는다 — 그래서 지금까지는
 * 경기가 끝나도 관리자가 각 매치 편집 화면에서 "경기 데이터 동기화"를 매번 따로
 * 눌러줘야 골드 그래프가 채워졌다. 이 함수는 그 수동 단계를 최근 종료된 경기들에
 * 대해 일괄로 대신 해준다(문서 8.1절 2~7단계와 동일한 순서: 세트 → 타임라인 → POM).
 *
 * 이미 다 채워진 매치까지 매일 다시 훑으면 Leaguepedia에 불필요한 요청이 계속 쌓이므로,
 * "세트가 하나도 없거나 / 타임라인 이벤트가 하나도 없거나 / 공식 POM이 비어있는" 매치만
 * 골라서 처리하고, 대상도 withinDays 기간 이내로 제한한다.
 */
export async function syncMatchDataForRecentCompletedMatches(
  supabase: SupabaseClient,
  options: { withinDays?: number; onProgress?: (message: string) => void } = {},
): Promise<MatchDataBulkSyncSummary> {
  const withinDays = options.withinDays ?? 60;
  const onProgress = options.onProgress;
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000).toISOString();

  const summary: MatchDataBulkSyncSummary = {
    matchesChecked: 0,
    matchesProcessed: 0,
    matchesSkipped: 0,
    setsUpserted: 0,
    timelineEventsInserted: 0,
    goldFramesInserted: 0,
    errors: [],
  };

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, official_pom_player_id, team_a_score, team_b_score")
    .eq("status", "completed")
    .not("leaguepedia_match_id", "is", null)
    .gte("match_date", since);
  if (matchesError) throw matchesError;

  summary.matchesChecked = matches.length;

  for (const match of matches) {
    const { data: sets, error: setsError } = await supabase
      .from("sets")
      .select("id")
      .eq("match_id", match.id);
    if (setsError) throw setsError;

    const setIds = (sets ?? []).map((s) => s.id);
    let timelineEventCount = 0;
    if (setIds.length > 0) {
      const { count, error: timelineCountError } = await supabase
        .from("timeline_events")
        .select("id", { count: "exact", head: true })
        .in("set_id", setIds);
      if (timelineCountError) throw timelineCountError;
      timelineEventCount = count ?? 0;
    }

    // 세트가 "하나라도" 있으면 완료로 치면, Leaguepedia에 일부 게임의 박스스코어만
    // 늦게 올라온 경우 그 세트를 영영 못 가져온다(backfill-leaguepedia-sets.ts와 동일한
    // 문제). 스코어로 추정한 완료 게임 수보다 세트 수가 적으면 계속 재시도 대상에 둔다.
    const expectedSets = (match.team_a_score ?? 0) + (match.team_b_score ?? 0);
    const setsIncomplete = setIds.length < expectedSets;
    const needsWork = setsIncomplete || timelineEventCount === 0 || !match.official_pom_player_id;
    if (!needsWork) {
      summary.matchesSkipped++;
      continue;
    }

    onProgress?.(`매치 ${match.id} 데이터 동기화 중...`);

    try {
      const setsSummary = await syncLeaguepediaMatchSets(supabase, match.id);
      summary.setsUpserted += setsSummary.upserted;
    } catch (error) {
      summary.errors.push({
        matchId: match.id,
        step: "sets",
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    try {
      const timelineSummary = await syncMatchTimeline(supabase, match.id, false);
      summary.timelineEventsInserted += timelineSummary.eventsInserted;
      summary.goldFramesInserted += timelineSummary.framesInserted;
    } catch (error) {
      summary.errors.push({
        matchId: match.id,
        step: "timeline",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await syncPomForMatch(supabase, match.id);
    } catch (error) {
      summary.errors.push({
        matchId: match.id,
        step: "pom",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    summary.matchesProcessed++;
  }

  return summary;
}
