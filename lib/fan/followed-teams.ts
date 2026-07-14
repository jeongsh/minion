import { createHash } from "crypto";
import { cookies } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FAN_VOTER_COOKIE = "lckhub_fan_voter";

export async function getFollowedTeamIds(): Promise<string[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FAN_VOTER_COOKIE)?.value;
  if (!raw) return [];

  const voterKey = createHash("sha256").update(raw).digest("hex");

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("team_fans")
      .select("team_id")
      .eq("voter_key", voterKey);

    if (error) throw error;
    const teamIds = (data ?? [])
      .map((row) => row.team_id)
      .filter((teamId): teamId is string => typeof teamId === "string");
    if (teamIds.length === 0) return [];

    const { data: teamRows, error: teamsError } = await supabase
      .from("teams")
      .select("id, fan_site_host")
      .in("id", teamIds);

    if (teamsError) throw teamsError;

    const keys = new Set(teamIds);
    for (const team of teamRows ?? []) {
      if (typeof team.fan_site_host === "string") keys.add(team.fan_site_host);
    }

    return [...keys];
  } catch {
    return [];
  }
}
