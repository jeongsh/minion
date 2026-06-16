import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CATALOG_CHAMPION_ID_PREFIX,
  championCatalogEntries,
  isCatalogChampionId,
} from "@/lib/champions";

export async function resolveChampionId(
  supabase: SupabaseClient,
  championId: string | null,
): Promise<string | null> {
  if (!championId) {
    return null;
  }

  if (!isCatalogChampionId(championId)) {
    return championId;
  }

  const ddragonId = championId.slice(CATALOG_CHAMPION_ID_PREFIX.length);
  const entry = championCatalogEntries().find((item) => item.ddragon_id === ddragonId);

  if (!entry) {
    return null;
  }

  const { data, error } = await supabase
    .from("champions")
    .upsert(entry, { onConflict: "slug" })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id;
}

export async function resolveChampionIds(
  supabase: SupabaseClient,
  championIds: Array<string | null>,
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(championIds.filter(Boolean))] as string[];
  const resolved = new Map<string, string>();

  for (const championId of uniqueIds) {
    const resolvedId = await resolveChampionId(supabase, championId);
    if (resolvedId) {
      resolved.set(championId, resolvedId);
    }
  }

  return resolved;
}
