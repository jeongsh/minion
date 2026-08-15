import "server-only";

import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const FAVORITE_TEAM_COOKIE = "minion_favorite_team";

export async function getFavoriteTeamId(): Promise<string | null> {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);

  if (user) {
    const { data, error } = await createSupabaseAdminClient()
      .from("profiles")
      .select("favorite_team_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && typeof data?.favorite_team_id === "string") return data.favorite_team_id;
  }

  return cookieStore.get(FAVORITE_TEAM_COOKIE)?.value ?? null;
}
