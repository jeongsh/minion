"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveChampionIds } from "@/lib/champions-admin";
import { reconcileMatchFromSets } from "@/lib/match-reconcile";
import { deriveSetStatus, hasCompletePlayerStats, normalizeSetStatus } from "@/lib/set-status";

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

function numberOrZero(value: FormDataEntryValue | null) {
  return numberOrNull(value) ?? 0;
}

// "27:35" -> 1655, "1655" -> 1655 (Leaguepedia sends raw seconds)
function durationToSeconds(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return null;
  }

  if (text.includes(":")) {
    const [minutePart, secondPart = "0"] = text.split(":");
    const minutes = Number(minutePart);
    const seconds = Number(secondPart);

    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return null;
    }

    return Math.round(minutes) * 60 + Math.round(seconds);
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

// K 단위 입력(80.4 -> 80400)은 blueGoldK/redGoldK로, 정확한 값은 blueGold/redGold로 들어온다.
function goldValue(formData: FormData, side: "blue" | "red") {
  const kName = side === "blue" ? "blueGoldK" : "redGoldK";
  const rawName = side === "blue" ? "blueGold" : "redGold";

  if (formData.has(kName)) {
    const k = numberOrNull(formData.get(kName));
    return k == null ? null : Math.round(k * 1000);
  }

  return numberOrNull(formData.get(rawName));
}

function countValue(formData: FormData, name: string) {
  return numberOrNull(formData.get(name)) ?? 0;
}

function dragonTotal(formData: FormData, side: "blue" | "red") {
  const explicitName = side === "blue" ? "blueDragons" : "redDragons";
  if (formData.has(explicitName)) {
    return numberOrNull(formData.get(explicitName));
  }

  const prefix = side === "blue" ? "blue" : "red";
  const values = ["Clouds", "Infernals", "Mountains", "Oceans", "Hextechs", "Chemtechs"].map((suffix) =>
    numberOrNull(formData.get(`${prefix}${suffix}`)),
  );
  const hasAnyValue = values.some((value) => value != null);

  return hasAnyValue ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

// 세트 상태(status)는 여기서 다루지 않는다 — 픽밴/선수스탯이 확정된 뒤
// deriveSetStatus()로 자동 계산해서 별도로 저장한다(createSetAction/updateSetAction 참고).
function setPayload(formData: FormData) {
  const matchId = textOrNull(formData.get("matchId"));
  const setNumber = numberOrNull(formData.get("setNumber"));

  if (!matchId || !setNumber) {
    throw new Error("경기와 세트 번호는 필수입니다.");
  }

  const blueTeamId = textOrNull(formData.get("blueTeamId"));
  const redTeamId = textOrNull(formData.get("redTeamId"));
  const winnerTeamId = textOrNull(formData.get("winnerTeamId"));
  const matchTeamAId = textOrNull(formData.get("matchTeamAId"));
  const matchTeamBId = textOrNull(formData.get("matchTeamBId"));

  // 매치 참가팀 정보가 함께 제출된 경우에만 검증한다(문서 5.2 불변조건).
  if (matchTeamAId && matchTeamBId) {
    const participantIds = new Set([matchTeamAId, matchTeamBId]);
    if (blueTeamId && redTeamId && blueTeamId === redTeamId) {
      throw new Error("블루팀과 레드팀은 서로 달라야 합니다.");
    }
    if (blueTeamId && !participantIds.has(blueTeamId)) {
      throw new Error("블루팀은 매치 참가팀 중 하나여야 합니다.");
    }
    if (redTeamId && !participantIds.has(redTeamId)) {
      throw new Error("레드팀은 매치 참가팀 중 하나여야 합니다.");
    }
    if (winnerTeamId && winnerTeamId !== blueTeamId && winnerTeamId !== redTeamId) {
      throw new Error("세트 승자는 블루팀 또는 레드팀 중 하나여야 합니다.");
    }
  }

  return {
    match_id: matchId,
    set_number: setNumber,
    winner_team_id: winnerTeamId,
    blue_team_id: blueTeamId,
    red_team_id: redTeamId,
    duration_seconds: durationToSeconds(formData.get("durationSeconds")),
    blue_kills: numberOrNull(formData.get("blueKills")),
    red_kills: numberOrNull(formData.get("redKills")),
    blue_gold: goldValue(formData, "blue"),
    red_gold: goldValue(formData, "red"),
    blue_dragons: dragonTotal(formData, "blue"),
    red_dragons: dragonTotal(formData, "red"),
    blue_clouds: numberOrNull(formData.get("blueClouds")),
    red_clouds: numberOrNull(formData.get("redClouds")),
    blue_infernals: numberOrNull(formData.get("blueInfernals")),
    red_infernals: numberOrNull(formData.get("redInfernals")),
    blue_mountains: numberOrNull(formData.get("blueMountains")),
    red_mountains: numberOrNull(formData.get("redMountains")),
    blue_oceans: numberOrNull(formData.get("blueOceans")),
    red_oceans: numberOrNull(formData.get("redOceans")),
    blue_hextechs: numberOrNull(formData.get("blueHextechs")),
    red_hextechs: numberOrNull(formData.get("redHextechs")),
    blue_chemtechs: numberOrNull(formData.get("blueChemtechs")),
    red_chemtechs: numberOrNull(formData.get("redChemtechs")),
    blue_elders: numberOrNull(formData.get("blueElders")),
    red_elders: numberOrNull(formData.get("redElders")),
    blue_rift_heralds: numberOrNull(formData.get("blueRiftHeralds")),
    red_rift_heralds: numberOrNull(formData.get("redRiftHeralds")),
    blue_void_grubs: numberOrNull(formData.get("blueVoidGrubs")),
    red_void_grubs: numberOrNull(formData.get("redVoidGrubs")),
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

type SetDetailsResult = {
  pickCount: number;
  banCount: number;
  playerStats: Array<{ playerId: string; teamId: string; position: string }>;
};

/**
 * 픽밴/선수스탯을 저장한다. createSetAction/updateSetAction이 공유 — 이전에는
 * updateSetAction에만 있어서 세트를 새로 만들 때 입력한 픽밴/스탯이 저장되지
 * 않는 결함이 있었다.
 */
async function applySetDetails(
  supabase: SupabaseClient,
  setId: string,
  formData: FormData,
): Promise<SetDetailsResult> {
  const pickBanCount = countValue(formData, "pickBanCount");
  const playerStatCount = countValue(formData, "playerStatCount");
  const championIdsToResolve: Array<string | null> = [];

  if (pickBanCount > 0) {
    for (let index = 0; index < pickBanCount; index += 1) {
      championIdsToResolve.push(textOrNull(formData.get(`pickBan.${index}.championId`)));
    }
  }

  if (playerStatCount > 0) {
    for (let index = 0; index < playerStatCount; index += 1) {
      championIdsToResolve.push(textOrNull(formData.get(`playerStat.${index}.championId`)));
    }
  }

  const resolvedChampionIds = await resolveChampionIds(supabase, championIdsToResolve);

  let pickCount = 0;
  let banCount = 0;

  if (pickBanCount > 0) {
    const pickBanPayload = Array.from({ length: pickBanCount }, (_, index) => {
      const rawChampionId = textOrNull(formData.get(`pickBan.${index}.championId`));
      const championId = rawChampionId ? resolvedChampionIds.get(rawChampionId) ?? rawChampionId : null;
      const teamId = textOrNull(formData.get(`pickBan.${index}.teamId`));
      const phase = textOrNull(formData.get(`pickBan.${index}.phase`));
      const actionType = textOrNull(formData.get(`pickBan.${index}.actionType`));
      const side = textOrNull(formData.get(`pickBan.${index}.side`));

      if (!championId || !teamId || !phase || !actionType || !side) {
        return null;
      }

      return {
        set_id: setId,
        phase,
        action_type: actionType,
        order_index: numberOrZero(formData.get(`pickBan.${index}.orderIndex`)),
        team_id: teamId,
        champion_id: championId,
        side,
      };
    }).filter(isPresent);

    if (pickBanPayload.length === 0) {
      throw new Error("저장할 밴픽 데이터가 유효하지 않습니다.");
    }

    // 삭제 후 삽입 대신, 기존 행 id를 먼저 확보해두고 새 데이터 삽입이 성공한 뒤에만 지운다.
    // 삽입 도중 실패해도 기존 밴픽 데이터가 사라지지 않는다.
    const { data: oldPickBans, error: oldPickBanError } = await supabase
      .from("set_picks_bans")
      .select("id")
      .eq("set_id", setId);
    if (oldPickBanError) {
      throw new Error(oldPickBanError.message);
    }

    const { error: insertPickBanError } = await supabase.from("set_picks_bans").insert(pickBanPayload);
    if (insertPickBanError) {
      throw new Error(insertPickBanError.message);
    }

    const oldPickBanIds = (oldPickBans ?? []).map((row) => row.id as string);
    if (oldPickBanIds.length > 0) {
      const { error: deletePickBanError } = await supabase
        .from("set_picks_bans")
        .delete()
        .in("id", oldPickBanIds);
      if (deletePickBanError) {
        throw new Error(deletePickBanError.message);
      }
    }

    pickCount = pickBanPayload.filter((entry) => entry.action_type === "pick").length;
    banCount = pickBanPayload.filter((entry) => entry.action_type === "ban").length;
  }

  let playerStats: SetDetailsResult["playerStats"] = [];

  if (playerStatCount > 0) {
    const statPayload = Array.from({ length: playerStatCount }, (_, index) => {
      const playerId = textOrNull(formData.get(`playerStat.${index}.playerId`));
      const teamId = textOrNull(formData.get(`playerStat.${index}.teamId`));
      const position = textOrNull(formData.get(`playerStat.${index}.position`));
      const side = textOrNull(formData.get(`playerStat.${index}.side`));
      const rawChampionId = textOrNull(formData.get(`playerStat.${index}.championId`));
      const championId = rawChampionId ? resolvedChampionIds.get(rawChampionId) ?? rawChampionId : null;

      if (!playerId || !teamId || !position || !side) {
        return null;
      }

      return {
        set_id: setId,
        player_id: playerId,
        team_id: teamId,
        side,
        position,
        champion_id: championId,
        kills: numberOrZero(formData.get(`playerStat.${index}.kills`)),
        deaths: numberOrZero(formData.get(`playerStat.${index}.deaths`)),
        assists: numberOrZero(formData.get(`playerStat.${index}.assists`)),
        cs: numberOrZero(formData.get(`playerStat.${index}.cs`)),
        gold: numberOrZero(formData.get(`playerStat.${index}.gold`)),
        damage_to_champions: numberOrZero(formData.get(`playerStat.${index}.damageToChampions`)),
        vision_score: numberOrZero(formData.get(`playerStat.${index}.visionScore`)),
        item0: numberOrNull(formData.get(`playerStat.${index}.item0`)),
        item1: numberOrNull(formData.get(`playerStat.${index}.item1`)),
        item2: numberOrNull(formData.get(`playerStat.${index}.item2`)),
        item3: numberOrNull(formData.get(`playerStat.${index}.item3`)),
        item4: numberOrNull(formData.get(`playerStat.${index}.item4`)),
        item5: numberOrNull(formData.get(`playerStat.${index}.item5`)),
        item6: numberOrNull(formData.get(`playerStat.${index}.item6`)),
        spell0: numberOrNull(formData.get(`playerStat.${index}.spell0`)),
        spell1: numberOrNull(formData.get(`playerStat.${index}.spell1`)),
        rune0: numberOrNull(formData.get(`playerStat.${index}.rune0`)),
        rune1: numberOrNull(formData.get(`playerStat.${index}.rune1`)),
      };
    }).filter(isPresent);

    if (statPayload.length === 0) {
      throw new Error("저장할 선수 스탯 데이터가 유효하지 않습니다.");
    }

    // delete-then-insert 대신 (set_id, player_id) upsert로 갱신하고,
    // 새 데이터에서 빠진 선수의 스탯만 별도로 정리한다.
    const { data: existingStatRows, error: existingStatsError } = await supabase
      .from("set_player_stats")
      .select("player_id")
      .eq("set_id", setId);
    if (existingStatsError) {
      throw new Error(existingStatsError.message);
    }

    const { error: upsertStatsError } = await supabase
      .from("set_player_stats")
      .upsert(statPayload, { onConflict: "set_id,player_id" });
    if (upsertStatsError) {
      throw new Error(upsertStatsError.message);
    }

    const keepPlayerIds = new Set(statPayload.map((stat) => stat.player_id));
    const stalePlayerIds = (existingStatRows ?? [])
      .map((row) => row.player_id as string)
      .filter((playerId) => !keepPlayerIds.has(playerId));
    if (stalePlayerIds.length > 0) {
      const { error: cleanupStatsError } = await supabase
        .from("set_player_stats")
        .delete()
        .eq("set_id", setId)
        .in("player_id", stalePlayerIds);
      if (cleanupStatsError) {
        throw new Error(cleanupStatsError.message);
      }
    }

    playerStats = statPayload.map((stat) => ({
      playerId: stat.player_id,
      teamId: stat.team_id,
      position: stat.position,
    }));
  }

  return { pickCount, banCount, playerStats };
}

async function saveSetAndReconcile(
  supabase: SupabaseClient,
  setId: string,
  payload: ReturnType<typeof setPayload>,
  formData: FormData,
) {
  const { pickCount, banCount, playerStats } = await applySetDetails(supabase, setId, formData);

  const hasGameStats =
    payload.winner_team_id != null ||
    payload.duration_seconds != null ||
    payload.blue_kills != null ||
    payload.red_kills != null;
  const status = deriveSetStatus({
    hasGameStats,
    hasPlayerStats: hasCompletePlayerStats(playerStats, payload.blue_team_id, payload.red_team_id),
    pickCount,
    banCount,
  });

  const { error: statusError } = await supabase.from("sets").update({ status }).eq("id", setId);
  if (statusError) {
    throw new Error(statusError.message);
  }

  await reconcileMatchFromSets(supabase, payload.match_id);
}

export async function createSetAction(formData: FormData) {
  const payload = setPayload(formData);
  const redirectTo = textOrNull(formData.get("redirectTo"));
  const supabase = createSupabaseAdminClient();
  const { data: inserted, error } = await supabase.from("sets").insert(payload).select("id").single();

  if (error) {
    throw new Error(error.message);
  }

  const setId = inserted.id as string;
  await saveSetAndReconcile(supabase, setId, payload, formData);

  revalidatePath("/admin/sets");
  revalidatePath(`/matches/${payload.match_id}`);

  if (redirectTo) {
    redirect(redirectTo);
  }
}

export async function updateSetAction(formData: FormData) {
  const setId = textOrNull(formData.get("setId"));
  const redirectTo = textOrNull(formData.get("redirectTo"));

  if (!setId) {
    throw new Error("수정할 세트 ID가 없습니다.");
  }

  const payload = setPayload(formData);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("sets").update(payload).eq("id", setId);

  if (error) {
    throw new Error(error.message);
  }

  await saveSetAndReconcile(supabase, setId, payload, formData);

  revalidatePath("/admin/sets");
  revalidatePath(`/matches/${payload.match_id}`);
  revalidatePath(`/matches/${payload.match_id}/sets/${setId}`);

  if (redirectTo) {
    redirect(redirectTo);
  }
}

export async function overrideSetResultAction(formData: FormData) {
  const setId = textOrNull(formData.get("setId"));
  const redirectTo = textOrNull(formData.get("redirectTo"));

  if (!setId) {
    throw new Error("보정할 세트 ID가 없습니다.");
  }

  const status = normalizeSetStatus(textOrNull(formData.get("status")));
  const supabase = createSupabaseAdminClient();
  const { data: updated, error } = await supabase
    .from("sets")
    .update({ status })
    .eq("id", setId)
    .select("match_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const matchId = updated.match_id as string;
  await reconcileMatchFromSets(supabase, matchId);

  revalidatePath("/admin/sets");
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/sets/${setId}`);

  if (redirectTo) {
    redirect(redirectTo);
  }
}
