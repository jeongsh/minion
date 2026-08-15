import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/current-user";
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from "@/lib/notifications";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export const getNotificationPreferences = cache(async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const user = await getCurrentUser();
  if (!user) return DEFAULT_NOTIFICATION_PREFERENCES;

  try {
    const supabase = await createSupabaseAuthClient();
    const { data, error } = await supabase
      .from("user_notification_preferences")
      .select("in_app_enabled, match_start_enabled, match_events_enabled, rating_open_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return DEFAULT_NOTIFICATION_PREFERENCES;
    return {
      inAppEnabled: data.in_app_enabled,
      matchStartEnabled: data.match_start_enabled,
      matchEventsEnabled: data.match_events_enabled,
      ratingOpenEnabled: data.rating_open_enabled,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
});
