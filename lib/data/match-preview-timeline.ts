import "server-only";
import { briefingDragonEvents, type DragonEvent } from "../match-preview-visuals.ts";
import type { SetFirstObjectives } from "../match-preview-records.ts";
import type { SetResult } from "../types.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

// Leaguepedia 보충 세트(leaguepedia-game:*)는 DB에 이벤트가 없고 UUID 필터를 깨뜨린다.
function databaseSetIds(sampleSetIds: string[]) {
  return [...new Set(sampleSetIds)].filter((id) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id));
}

/** 표본 세트별 첫 킬, 첫 타워, 첫 전령, 첫 바론 팀. set_first_objectives 뷰가 타임라인에서 계산한다. */
export async function getSetFirstObjectives(sampleSetIds: string[]): Promise<SetFirstObjectives[]> {
  const setIds = databaseSetIds(sampleSetIds);
  const admin = createSupabaseAdminClient();
  const rows: SetFirstObjectives[] = [];
  for (let index = 0; index < setIds.length; index += 100) {
    const { data, error } = await admin.from("set_first_objectives")
      .select("set_id,first_kill_team_id,first_tower_team_id,first_herald_team_id,first_baron_team_id")
      .in("set_id", setIds.slice(index, index + 100));
    if (error) throw new Error(`첫 오브젝트 조회 실패: ${error.message}`);
    for (const row of data ?? []) {
      rows.push({
        setId: row.set_id as string,
        kill: row.first_kill_team_id as string | null,
        tower: row.first_tower_team_id as string | null,
        herald: row.first_herald_team_id as string | null,
        baron: row.first_baron_team_id as string | null,
      });
    }
  }
  return rows;
}

/** 표본 세트의 원소 드래곤 처치 이벤트. 장로 드래곤은 첫 드래곤 시점에서 뺀다. */
export async function getDragonEvents(sampleSetIds: string[], sets: SetResult[] = []): Promise<DragonEvent[]> {
  const setIds = databaseSetIds(sampleSetIds);
  const admin = createSupabaseAdminClient();
  const events: DragonEvent[] = briefingDragonEvents(sets, sampleSetIds);
  for (let index = 0; index < setIds.length; index += 100) {
    const { data, error } = await admin.from("timeline_events").select("set_id,team_id,timestamp_ms")
      .eq("event_type", "ELITE_MONSTER_KILL").in("monster_type", ["DRAGON", "AIR_DRAGON", "EARTH_DRAGON", "FIRE_DRAGON", "WATER_DRAGON", "HEXTECH_DRAGON", "CHEMTECH_DRAGON"])
      .in("set_id", setIds.slice(index, index + 100));
    if (error) throw new Error(`드래곤 이벤트 조회 실패: ${error.message}`);
    for (const row of data ?? []) {
      if (typeof row.timestamp_ms === "number") {
        events.push({ setId: row.set_id as string, teamId: row.team_id as string | null, timestampMs: row.timestamp_ms });
      }
    }
  }
  return events;
}
