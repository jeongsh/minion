"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/current-user";
import type { NotificationPreferences } from "@/lib/notifications";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export async function updateNotificationPreferencesAction(input: NotificationPreferences) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "로그인이 필요합니다." };

  try {
    const supabase = await createSupabaseAuthClient();
    const { error } = await supabase.from("user_notification_preferences").upsert({
      user_id: user.id,
      in_app_enabled: Boolean(input.inAppEnabled),
      match_start_enabled: Boolean(input.matchStartEnabled),
      match_events_enabled: Boolean(input.matchEventsEnabled),
      rating_open_enabled: Boolean(input.ratingOpenEnabled),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) return { ok: false as const, error: "알림 설정을 저장하지 못했습니다." };
    revalidatePath("/", "layout");
    revalidatePath("/me/settings");
    revalidatePath("/me");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "알림 설정을 저장하지 못했습니다." };
  }
}
