import "server-only";
import { briefingDragonEvents, type DragonEvent } from "../match-preview-visuals.ts";
import type { SetResult } from "../types.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

/** 표본 세트의 원소 드래곤 처치 이벤트. 장로 드래곤은 첫 드래곤 시점에서 뺀다. */
export async function getDragonEvents(sampleSetIds: string[], sets: SetResult[] = []): Promise<DragonEvent[]> {
  // Leaguepedia 보충 세트(leaguepedia-game:*)는 DB에 이벤트가 없고 UUID 필터를 깨뜨린다.
  const setIds = sampleSetIds.filter((id) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id));
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
