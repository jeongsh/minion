"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/current-user";
import type { NotificationPreferences, TeamNotificationPreferences } from "@/lib/notifications";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export async function updateNotificationPreferencesAction(
  input: NotificationPreferences,
  teamSettings: TeamNotificationPreferences[],
) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };

  try {
    const supabase = await createSupabaseAuthClient();
    const teamIds = [...new Set(teamSettings.map((setting) => setting.teamId))];
    if (teamIds.length !== teamSettings.length || teamIds.length > 20) {
      return { ok: false as const, error: "팀별 알림 설정이 올바르지 않습니다." };
    }
    if (teamIds.length > 0) {
      const { data: subscriptions, error: subscriptionReadError } = await supabase
        .from("fan_notification_subscriptions")
        .select("team_id")
        .in("team_id", teamIds);
      const existingTeamIds = new Set((subscriptions ?? []).map((row) => row.team_id));
      if (subscriptionReadError || teamIds.some((teamId) => !existingTeamIds.has(teamId))) {
        return { ok: false as const, error: "팔로우한 팀의 알림만 변경할 수 있습니다." };
      }
    }

    const { error } = await supabase.from("user_notification_preferences").upsert({
      user_id: user.id,
      in_app_enabled: Boolean(input.inAppEnabled),
      community_enabled: Boolean(input.communityEnabled),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) return { ok: false as const, error: "알림 설정을 저장하지 못했습니다." };

    if (teamIds.length > 0) {
      const updatedAt = new Date().toISOString();
      const { error: teamError } = await supabase.from("fan_notification_subscriptions").upsert(
        teamSettings.map((setting) => ({
          user_id: user.id,
          team_id: setting.teamId,
          match_alerts: Boolean(setting.matchAlertsEnabled),
          live_match_alerts: Boolean(setting.liveMatchAlertsEnabled),
          instagram_alerts: Boolean(setting.instagramAlertsEnabled),
          video_alerts: Boolean(setting.videoAlertsEnabled),
          solo_queue_alerts: Boolean(setting.soloQueueAlertsEnabled),
          news_alerts: Boolean(setting.instagramAlertsEnabled || setting.videoAlertsEnabled),
          updated_at: updatedAt,
        })),
        { onConflict: "user_id,team_id" },
      );
      if (teamError) return { ok: false as const, error: "팀별 알림 설정을 저장하지 못했습니다." };
    }

    revalidatePath("/", "layout");
    revalidatePath("/me/settings");
    revalidatePath("/me");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "알림 설정을 저장하지 못했습니다." };
  }
}
