import "server-only";

import type { TeamNotificationPreferences } from "@/lib/notifications";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

type SubscriptionRow = {
  team_id: string;
  match_alerts: boolean;
  live_match_alerts: boolean;
  instagram_alerts: boolean;
  video_alerts: boolean;
  solo_queue_alerts: boolean;
};

export async function getTeamNotificationPreferences(): Promise<TeamNotificationPreferences[]> {
  try {
    const supabase = await createSupabaseAuthClient();
    const { data: subscriptions, error } = await supabase
      .from("fan_notification_subscriptions")
      .select("team_id, match_alerts, live_match_alerts, instagram_alerts, video_alerts, solo_queue_alerts")
      .order("created_at", { ascending: true });
    if (error || !subscriptions?.length) return [];

    const rows = subscriptions as SubscriptionRow[];
    const { data: teams, error: teamError } = await supabase
      .from("teams")
      .select("id, name, short_name, logo_url")
      .in("id", rows.map((row) => row.team_id));
    if (teamError) return [];

    const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
    return rows.flatMap((row) => {
      const team = teamById.get(row.team_id);
      if (!team) return [];
      return [{
        teamId: row.team_id,
        teamName: team.name,
        teamShortName: team.short_name ?? team.name,
        teamLogoUrl: team.logo_url,
        matchAlertsEnabled: row.match_alerts,
        liveMatchAlertsEnabled: row.live_match_alerts,
        instagramAlertsEnabled: row.instagram_alerts,
        videoAlertsEnabled: row.video_alerts,
        soloQueueAlertsEnabled: row.solo_queue_alerts,
      }];
    });
  } catch {
    return [];
  }
}
