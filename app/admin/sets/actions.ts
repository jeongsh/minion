"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

function setPayload(formData: FormData) {
  const matchId = textOrNull(formData.get("matchId"));
  const setNumber = numberOrNull(formData.get("setNumber"));

  if (!matchId || !setNumber) {
    throw new Error("경기와 세트 번호는 필수입니다.");
  }

  return {
    match_id: matchId,
    set_number: setNumber,
    winner_team_id: textOrNull(formData.get("winnerTeamId")),
    blue_team_id: textOrNull(formData.get("blueTeamId")),
    red_team_id: textOrNull(formData.get("redTeamId")),
    duration_seconds: numberOrNull(formData.get("durationSeconds")),
    blue_kills: numberOrNull(formData.get("blueKills")),
    red_kills: numberOrNull(formData.get("redKills")),
    blue_gold: numberOrNull(formData.get("blueGold")),
    red_gold: numberOrNull(formData.get("redGold")),
    blue_dragons: numberOrNull(formData.get("blueDragons")),
    red_dragons: numberOrNull(formData.get("redDragons")),
    blue_barons: numberOrNull(formData.get("blueBarons")),
    red_barons: numberOrNull(formData.get("redBarons")),
    blue_towers: numberOrNull(formData.get("blueTowers")),
    red_towers: numberOrNull(formData.get("redTowers")),
    patch: textOrNull(formData.get("patch")),
    leaguepedia_game_id: textOrNull(formData.get("leaguepediaGameId")),
    riot_match_id: textOrNull(formData.get("riotMatchId")),
    riot_platform_game_id: textOrNull(formData.get("riotPlatformGameId")),
  };
}

export async function createSetAction(formData: FormData) {
  const payload = setPayload(formData);
  const { error } = await createSupabaseAdminClient().from("sets").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/sets");
  revalidatePath(`/matches/${payload.match_id}`);
}

export async function updateSetAction(formData: FormData) {
  const setId = textOrNull(formData.get("setId"));

  if (!setId) {
    throw new Error("수정할 세트 ID가 없습니다.");
  }

  const payload = setPayload(formData);
  const { error } = await createSupabaseAdminClient()
    .from("sets")
    .update(payload)
    .eq("id", setId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/sets");
  revalidatePath(`/matches/${payload.match_id}`);
  revalidatePath(`/matches/${payload.match_id}/sets/${setId}`);
}
