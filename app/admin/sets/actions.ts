"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveChampionIds } from "@/lib/champions-admin";
import { normalizeSetStatus } from "@/lib/set-status";

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

function setPayload(formData: FormData) {
  const matchId = textOrNull(formData.get("matchId"));
  const setNumber = numberOrNull(formData.get("setNumber"));

  if (!matchId || !setNumber) {
    throw new Error("경기와 세트 번호는 필수입니다.");
  }

  return {
    match_id: matchId,
    set_number: setNumber,
    status: normalizeSetStatus(textOrNull(formData.get("status"))),
    winner_team_id: textOrNull(formData.get("winnerTeamId")),
    blue_team_id: textOrNull(formData.get("blueTeamId")),
    red_team_id: textOrNull(formData.get("redTeamId")),
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

export async function createSetAction(formData: FormData) {
  const payload = setPayload(formData);
  const redirectTo = textOrNull(formData.get("redirectTo"));
  const { error } = await createSupabaseAdminClient().from("sets").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

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
  const { error } = await supabase
    .from("sets")
    .update(payload)
    .eq("id", setId);

  if (error) {
    throw new Error(error.message);
  }

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

    const { error: deletePickBanError } = await supabase.from("set_picks_bans").delete().eq("set_id", setId);
    if (deletePickBanError) {
      throw new Error(deletePickBanError.message);
    }

    if (pickBanPayload.length > 0) {
      const { error: insertPickBanError } = await supabase.from("set_picks_bans").insert(pickBanPayload);
      if (insertPickBanError) {
        throw new Error(insertPickBanError.message);
      }
    }
  }

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

    const { error: deleteStatsError } = await supabase.from("set_player_stats").delete().eq("set_id", setId);
    if (deleteStatsError) {
      throw new Error(deleteStatsError.message);
    }

    if (statPayload.length > 0) {
      const { error: insertStatsError } = await supabase.from("set_player_stats").insert(statPayload);
      if (insertStatsError) {
        throw new Error(insertStatsError.message);
      }
    }
  }

  revalidatePath("/admin/sets");
  revalidatePath(`/matches/${payload.match_id}`);
  revalidatePath(`/matches/${payload.match_id}/sets/${setId}`);

  if (redirectTo) {
    redirect(redirectTo);
  }
}
