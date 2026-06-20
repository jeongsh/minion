"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getLastCompletedMatchCursor,
  syncLeaguepediaLck2026,
  type LeaguepediaSyncSummary,
} from "@/lib/sync/leaguepedia-lck-2026";
import {
  syncLeaguepediaMatchSets,
  type LeaguepediaMatchSetsSyncSummary,
} from "@/lib/sync/leaguepedia-match-sets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Match } from "@/lib/types";
import { matchRouteId, parseDateTimeLocalKST } from "@/lib/view-data";

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

    return { ok: true, summary };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Leaguepedia 세트 정보 불러오기에 실패했습니다.";
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

function matchPayload(formData: FormData) {
  const name = textOrNull(formData.get("name"));
  const matchDate = textOrNull(formData.get("matchDate"));
  const status = textOrNull(formData.get("status")) ?? "scheduled";

  if (!name || !matchDate) {
    throw new Error("경기명과 경기 일시는 필수입니다.");
  }

  if (!["scheduled", "live", "completed"].includes(status)) {
    throw new Error("지원하지 않는 경기 상태입니다.");
  }

  return {
    tournament_id: textOrNull(formData.get("tournamentId")),
    stage_id: textOrNull(formData.get("stageId")),
    name,
    match_date: parseDateTimeLocalKST(matchDate),
    status,
    team_a_id: textOrNull(formData.get("teamAId")),
    team_b_id: textOrNull(formData.get("teamBId")),
    team_a_score: numberOrNull(formData.get("teamAScore")),
    team_b_score: numberOrNull(formData.get("teamBScore")),
    best_of: numberOrNull(formData.get("bestOf")),
    winner_team_id: textOrNull(formData.get("winnerTeamId")),
    official_pom_player_id: textOrNull(formData.get("officialPomPlayerId")),
    leaguepedia_match_id: textOrNull(formData.get("leaguepediaMatchId")),
    venue: textOrNull(formData.get("venue")),
    vod_url: textOrNull(formData.get("vodUrl")),
  };
}

export async function createMatchAction(formData: FormData) {
  const payload = matchPayload(formData);
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

  const payload = matchPayload(formData);
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
