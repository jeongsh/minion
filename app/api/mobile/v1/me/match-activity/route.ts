import type { MobileMatchActivityDto, MobileNotificationPreferences } from "@/packages/contracts/src/mobile-v1";
import { getMatchActivityForTeamKeys } from "@/lib/match-activity-server";
import { getMobileAuth } from "@/lib/mobile/auth";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const defaultPreferences: MobileNotificationPreferences = {
  inAppEnabled: true,
  matchStartEnabled: true,
  matchEventsEnabled: false,
  ratingOpenEnabled: true,
};

export async function GET(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);

  const admin = createSupabaseAdminClient();
  const [{ data: fanRows, error: fanError }, { data: preferenceRow, error: preferenceError }] = await Promise.all([
    admin.from("team_fans").select("team_id").eq("user_id", auth.user.id),
    auth.supabase
      .from("user_notification_preferences")
      .select("in_app_enabled, match_start_enabled, match_events_enabled, rating_open_enabled")
      .eq("user_id", auth.user.id)
      .maybeSingle(),
  ]);
  if (fanError || preferenceError) return mobileError("INTERNAL", "알림 상태를 불러오지 못했습니다.", 500);

  const activity = await getMatchActivityForTeamKeys((fanRows ?? []).map((row) => row.team_id));
  const data: MobileMatchActivityDto = {
    ...activity,
    notificationPreferences: preferenceRow ? {
      inAppEnabled: preferenceRow.in_app_enabled,
      matchStartEnabled: preferenceRow.match_start_enabled,
      matchEventsEnabled: preferenceRow.match_events_enabled,
      ratingOpenEnabled: preferenceRow.rating_open_enabled,
    } : defaultPreferences,
  };

  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
