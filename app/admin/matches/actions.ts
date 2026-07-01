"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getMatchById, getSetsByMatchId } from "@/lib/data/lck";
import { diagnoseMatches, type MatchDiagnosis } from "@/lib/match-diagnostics";
import {
  getLastCompletedMatchCursor,
  syncLeaguepediaLck2026,
  type LeaguepediaSyncSummary,
} from "@/lib/sync/leaguepedia-lck-2026";
import {
  syncLeaguepediaMatchSets,
  type LeaguepediaMatchSetsSyncSummary,
} from "@/lib/sync/leaguepedia-match-sets";
import { syncPomForMatch, type SinglePomSyncResult } from "@/lib/sync/sync-pom";
import {
  syncMatchTimeline,
  type TimelineSyncSummary,
} from "@/lib/sync/timeline-events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Match } from "@/lib/types";
import { matchRouteId, parseDateTimeLocalKST } from "@/lib/view-data";

async function revalidateMatchPaths(supabase: SupabaseClient, matchId: string) {
  const { data: match } = await supabase
    .from("matches")
    .select("id, leaguepedia_match_id")
    .eq("id", matchId)
    .maybeSingle();

  revalidatePath("/admin/matches");
  revalidatePath("/admin/sets");
  revalidatePath(`/matches/${matchId}`);

  if (match) {
    const routeId = matchRouteId({
      id: match.id,
      leaguepediaMatchId: match.leaguepedia_match_id,
    } as Match);
    revalidatePath(`/admin/matches/${routeId}/edit`);
    revalidatePath(`/matches/${routeId}`);
  }
}

export type SyncLeaguepediaActionResult =
  | {
      ok: true;
      summary: LeaguepediaSyncSummary;
    }
  | {
      ok: false;
      error: string;
    };

export type SyncLeaguepediaSetsActionResult =
  | {
      ok: true;
      summary: LeaguepediaMatchSetsSyncSummary;
    }
  | {
      ok: false;
      error: string;
    };

export async function syncLeaguepediaMatchesAction(
  mode: "incremental" | "full" = "incremental",
): Promise<SyncLeaguepediaActionResult> {
  try {
    const supabase = createSupabaseAdminClient();
    const summary = await syncLeaguepediaLck2026(supabase, { mode });

    revalidatePath("/admin/matches");
    revalidatePath("/schedule");
    revalidatePath("/");

    return { ok: true, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leaguepedia 동기화에 실패했습니다.";
    return { ok: false, error: message };
  }
}

export async function getLeaguepediaSyncCursor() {
  const supabase = createSupabaseAdminClient();
  return getLastCompletedMatchCursor(supabase);
}

export async function syncLeaguepediaMatchSetsAction(
  matchId: string,
): Promise<SyncLeaguepediaSetsActionResult> {
  try {
    const supabase = createSupabaseAdminClient();
    const summary = await syncLeaguepediaMatchSets(supabase, matchId);
    await revalidateMatchPaths(supabase, matchId);
    return { ok: true, summary };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Leaguepedia 세트 정보 불러오기에 실패했습니다.";
    return { ok: false, error: message };
  }
}

export type SyncTimelineActionResult =
  | { ok: true; summary: TimelineSyncSummary }
  | { ok: false; error: string };

export async function syncTimelineAction(
  matchId: string,
  force = true,
): Promise<SyncTimelineActionResult> {
  try {
    const supabase = createSupabaseAdminClient();
    const summary = await syncMatchTimeline(supabase, matchId, force);
    revalidatePath(`/matches/${matchId}`);
    return { ok: true, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "타임라인 불러오기에 실패했습니다.";
    return { ok: false, error: message };
  }
}

export type SyncMatchDataActionResult =
  | {
      ok: true;
      setsSummary: LeaguepediaMatchSetsSyncSummary;
      timelineSummary: TimelineSyncSummary | null;
      timelineError: string | null;
      pomResult: SinglePomSyncResult | null;
      pomError: string | null;
    }
  | { ok: false; error: string };

/**
 * "경기 데이터 동기화" 통합 액션: 세트 결과(+밴픽/선수스탯/매치 재조정) 동기화 후,
 * Game ID가 준비된 세트에 한해 타임라인도, 공식 POM도 이어서 동기화한다(문서 8.1절
 * 순서 중 2~7단계 — 1단계 Leaguepedia MatchSchedule 단일 매치 새로고침은 이번 범위
 * 제외). 타임라인/POM 단계가 실패해도 이미 끝난 세트 동기화 결과는 버리지 않고
 * 함께 반환한다. POM은 이미 수동으로 지정돼 있으면 덮어쓰지 않는다.
 */
export async function syncMatchDataAction(matchId: string): Promise<SyncMatchDataActionResult> {
  const supabase = createSupabaseAdminClient();

  let setsSummary: LeaguepediaMatchSetsSyncSummary;
  try {
    setsSummary = await syncLeaguepediaMatchSets(supabase, matchId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Leaguepedia 세트 정보 불러오기에 실패했습니다.";
    return { ok: false, error: message };
  }

  let timelineSummary: TimelineSyncSummary | null = null;
  let timelineError: string | null = null;
  try {
    timelineSummary = await syncMatchTimeline(supabase, matchId, false);
  } catch (error) {
    timelineError = error instanceof Error ? error.message : "타임라인 동기화에 실패했습니다.";
  }

  let pomResult: SinglePomSyncResult | null = null;
  let pomError: string | null = null;
  try {
    pomResult = await syncPomForMatch(supabase, matchId);
  } catch (error) {
    pomError = error instanceof Error ? error.message : "POM 동기화에 실패했습니다.";
  }

  await revalidateMatchPaths(supabase, matchId);

  return { ok: true, setsSummary, timelineSummary, timelineError, pomResult, pomError };
}

export type CheckMatchConsistencyActionResult =
  | { ok: true; diagnosis: MatchDiagnosis }
  | { ok: false; error: string };

/** "데이터 일관성 재검사": 아무것도 쓰지 않고 이 매치 1건을 diagnoseMatches()로 재검사한다. */
export async function checkMatchConsistencyAction(
  matchId: string,
): Promise<CheckMatchConsistencyActionResult> {
  try {
    const match = await getMatchById(matchId);
    if (!match) {
      throw new Error("경기를 찾을 수 없습니다.");
    }
    const sets = await getSetsByMatchId(match.id);
    const setIds = sets.map((set) => set.id);

    const supabase = createSupabaseAdminClient();
    const [pickBanRes, playerStatRes] =
      setIds.length > 0
        ? await Promise.all([
            supabase.from("set_picks_bans").select("set_id, action_type").in("set_id", setIds),
            supabase
              .from("set_player_stats")
              .select("set_id, player_id, team_id, position")
              .in("set_id", setIds),
          ])
        : [
            { data: [], error: null } as const,
            { data: [], error: null } as const,
          ];
    if (pickBanRes.error) {
      throw pickBanRes.error;
    }
    if (playerStatRes.error) {
      throw playerStatRes.error;
    }

    const diagnosis = diagnoseMatches(
      [
        {
          id: match.id,
          name: match.name,
          teamAId: match.teamAId || null,
          teamBId: match.teamBId || null,
          bestOf: match.bestOf ?? null,
          status: match.status,
          teamAScore: match.teamAScore,
          teamBScore: match.teamBScore,
          winnerTeamId: match.winnerTeamId ?? null,
        },
      ],
      sets.map((set) => ({
        id: set.id,
        matchId: set.matchId,
        setNumber: set.setNumber,
        status: set.status,
        winnerTeamId: set.winnerTeamId,
        blueTeamId: set.blueTeamId || null,
        redTeamId: set.redTeamId || null,
        durationSeconds: set.durationSeconds,
        blueKills: set.blueKills,
        redKills: set.redKills,
      })),
      (pickBanRes.data ?? []).map((row) => ({ setId: row.set_id, actionType: row.action_type })),
      (playerStatRes.data ?? []).map((row) => ({
        setId: row.set_id,
        playerId: row.player_id,
        teamId: row.team_id,
        position: row.position,
      })),
    );

    return { ok: true, diagnosis };
  } catch (error) {
    const message = error instanceof Error ? error.message : "데이터 일관성 검사에 실패했습니다.";
    return { ok: false, error: message };
  }
}

function textOrNull(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

// 매치가 직접 소유하는 값(문서 4.2절). 스코어/상태/승자는 세트 결과로부터 집계되는
// 값이라 여기서 다루지 않는다 — resultOverridePayload()의 수동 보정 흐름으로 분리.
function basicMatchPayload(formData: FormData) {
  const name = textOrNull(formData.get("name"));
  const matchDate = textOrNull(formData.get("matchDate"));

  if (!name || !matchDate) {
    throw new Error("경기명과 경기 일시는 필수입니다.");
  }

  return {
    tournament_id: textOrNull(formData.get("tournamentId")),
    stage_id: textOrNull(formData.get("stageId")),
    name,
    match_date: parseDateTimeLocalKST(matchDate),
    team_a_id: textOrNull(formData.get("teamAId")),
    team_b_id: textOrNull(formData.get("teamBId")),
    best_of: numberOrNull(formData.get("bestOf")),
    official_pom_player_id: textOrNull(formData.get("officialPomPlayerId")),
    leaguepedia_match_id: textOrNull(formData.get("leaguepediaMatchId")),
    venue: textOrNull(formData.get("venue")),
    vod_url: textOrNull(formData.get("vodUrl")),
  };
}

// 세트 집계에서 벗어난 수동 보정 전용 값(문서 4.3절 예외 흐름).
function resultOverridePayload(formData: FormData) {
  const status = textOrNull(formData.get("status")) ?? "scheduled";

  if (!["scheduled", "live", "completed"].includes(status)) {
    throw new Error("지원하지 않는 경기 상태입니다.");
  }

  return {
    team_a_score: numberOrNull(formData.get("teamAScore")),
    team_b_score: numberOrNull(formData.get("teamBScore")),
    status,
    winner_team_id: textOrNull(formData.get("winnerTeamId")),
  };
}

export async function createMatchAction(formData: FormData) {
  const payload = basicMatchPayload(formData);
  const { error } = await createSupabaseAdminClient().from("matches").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/matches");
  revalidatePath("/schedule");
}

export async function updateMatchAction(formData: FormData) {
  const matchId = textOrNull(formData.get("matchId"));
  const redirectTo = textOrNull(formData.get("redirectTo"));

  if (!matchId) {
    throw new Error("수정할 경기 ID가 없습니다.");
  }

  const payload = basicMatchPayload(formData);
  const { error } = await createSupabaseAdminClient()
    .from("matches")
    .update(payload)
    .eq("id", matchId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/matches");
  revalidatePath("/schedule");
  revalidatePath(`/matches/${matchId}`);

  if (redirectTo) {
    redirect(redirectTo);
  }
}

export async function overrideMatchResultAction(formData: FormData) {
  const matchId = textOrNull(formData.get("matchId"));
  const redirectTo = textOrNull(formData.get("redirectTo"));

  if (!matchId) {
    throw new Error("보정할 경기 ID가 없습니다.");
  }

  const payload = resultOverridePayload(formData);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("matches").update(payload).eq("id", matchId);

  if (error) {
    throw new Error(error.message);
  }

  await revalidateMatchPaths(supabase, matchId);

  if (redirectTo) {
    redirect(redirectTo);
  }
}
