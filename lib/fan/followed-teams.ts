import { createHash } from "crypto";
import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FAN_VOTER_COOKIE = "lckhub_fan_voter";

export async function getFollowedTeamIds(): Promise<string[]> {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const raw = cookieStore.get(FAN_VOTER_COOKIE)?.value;
  if (!user && !raw) return [];

  const voterKey = raw ? createHash("sha256").update(raw).digest("hex") : null;

  try {
    const supabase = createSupabaseAdminClient();
    // 팔로우는 계정(user_id)과 쿠키(voter_key) 두 경로로 쌓인다(actions.ts findFanRow와 동일).
    // 한쪽만 보면 다른 기기/브라우저에서 누른 팔로우가 LNB에 빠진다.
    const filters: string[] = [];
    if (user) filters.push(`user_id.eq.${user.id}`);
    if (voterKey) filters.push(`voter_key.eq.${voterKey}`);

    const { data, error } = await supabase
      .from("team_fans")
      .select("team_id")
      .or(filters.join(","));

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
