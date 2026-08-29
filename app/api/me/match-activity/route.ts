import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getMatchActivityForTeamKeys } from "@/lib/match-activity-server";
import type { MatchActivityNotificationResponse } from "@/lib/match-activity";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createSupabaseAuthClient();
  const { data: subscriptions, error } = await supabase
    .from("fan_notification_subscriptions")
    .select("team_id, match_alerts, live_match_alerts")
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: "알림 상태를 불러오지 못했습니다." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }

  const activity = await getMatchActivityForTeamKeys((subscriptions ?? []).map((row) => row.team_id));
  const data: MatchActivityNotificationResponse = {
    ...activity,
    teamNotificationSettings: (subscriptions ?? []).map((row) => ({
      teamId: row.team_id,
      matchAlertsEnabled: row.match_alerts,
      liveMatchAlertsEnabled: row.live_match_alerts,
    })),
  };
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
