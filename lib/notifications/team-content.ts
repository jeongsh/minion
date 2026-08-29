import type { SupabaseClient } from "@supabase/supabase-js";

import { sendExpoPushNotifications } from "../notify/push.ts";

const RECIPIENT_BATCH_SIZE = 500;
const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export type TeamContentNotificationKind = "team_video" | "team_social";

export type TeamContentNotificationInput = {
  kind: TeamContentNotificationKind;
  sourceId: string;
  teamId: string;
  contentTitle: string;
  imageUrl?: string | null;
  publishedAt?: string | null;
};

export type TeamContentNotificationSummary = {
  notificationsCreated: number;
  pushSent: number;
};

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function compactText(value: string, maximumLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maximumLength ? compact : `${compact.slice(0, maximumLength - 1).trimEnd()}…`;
}

export function isRecentTeamContent(publishedAt?: string | null, now = Date.now()) {
  if (!publishedAt) return true;
  const publishedTime = new Date(publishedAt).getTime();
  if (!Number.isFinite(publishedTime)) return false;
  const age = now - publishedTime;
  return age >= -5 * 60_000 && age <= NOTIFICATION_WINDOW_MS;
}

export async function notifyTeamContentUpdate(
  admin: SupabaseClient,
  input: TeamContentNotificationInput,
): Promise<TeamContentNotificationSummary> {
  if (!isRecentTeamContent(input.publishedAt)) return { notificationsCreated: 0, pushSent: 0 };
  const subscriptionColumn = input.kind === "team_video" ? "video_alerts" : "instagram_alerts";

  const [{ data: team, error: teamError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
    admin.from("teams").select("name, short_name, fan_site_host, slug").eq("id", input.teamId).maybeSingle(),
    admin
      .from("fan_notification_subscriptions")
      .select("user_id")
      .eq("team_id", input.teamId)
      .eq(subscriptionColumn, true),
  ]);
  if (teamError) throw teamError;
  if (subscriptionError) throw subscriptionError;
  if (!team) return { notificationsCreated: 0, pushSent: 0 };

  const subscribedUserIds = [...new Set((subscriptions ?? []).map((row) => row.user_id as string))];
  if (subscribedUserIds.length === 0) return { notificationsCreated: 0, pushSent: 0 };

  const optedOutUserIds = new Set<string>();
  for (const userIds of chunk(subscribedUserIds, RECIPIENT_BATCH_SIZE)) {
    const { data, error } = await admin
      .from("user_notification_preferences")
      .select("user_id, in_app_enabled")
      .in("user_id", userIds);
    if (error) throw error;
    for (const preference of data ?? []) {
      if (preference.in_app_enabled === false) optedOutUserIds.add(preference.user_id);
    }
  }

  const recipientUserIds = subscribedUserIds.filter((userId) => !optedOutUserIds.has(userId));
  if (recipientUserIds.length === 0) return { notificationsCreated: 0, pushSent: 0 };

  const teamName = team.short_name ?? team.name;
  const fanSlug = team.fan_site_host ?? team.slug;
  const title = input.kind === "team_video" ? `${teamName} 새 영상` : `${teamName} 새 소셜`;
  const description = input.kind === "team_video"
    ? compactText(input.contentTitle || "새 영상이 올라왔어요.", 80)
    : "새 게시물이 올라왔어요.";
  const href = input.kind === "team_video"
    ? `/fan/${encodeURIComponent(fanSlug)}/videos`
    : `/fan/${encodeURIComponent(fanSlug)}/social`;

  const createdRows: Array<{ id: string; recipient_user_id: string }> = [];
  for (const userIds of chunk(recipientUserIds, RECIPIENT_BATCH_SIZE)) {
    const rows = userIds.map((userId) => ({
      recipient_user_id: userId,
      team_id: input.teamId,
      kind: input.kind,
      source_id: input.sourceId,
      title,
      description,
      href,
      image_url: input.imageUrl ?? null,
      dedupe_key: `${input.kind}:${input.sourceId}:${userId}`,
    }));
    const { data, error } = await admin
      .from("team_content_notifications")
      .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id, recipient_user_id");
    if (error) throw error;
    createdRows.push(...((data ?? []) as Array<{ id: string; recipient_user_id: string }>));
  }

  if (createdRows.length === 0) return { notificationsCreated: 0, pushSent: 0 };

  const createdByUserId = new Map(createdRows.map((row) => [row.recipient_user_id, row.id]));
  const tokens: Array<{ user_id: string; expo_push_token: string }> = [];
  for (const userIds of chunk([...createdByUserId.keys()], RECIPIENT_BATCH_SIZE)) {
    const { data, error } = await admin
      .from("push_tokens")
      .select("user_id, expo_push_token")
      .in("user_id", userIds);
    if (error) throw error;
    tokens.push(...((data ?? []) as Array<{ user_id: string; expo_push_token: string }>));
  }

  const pushResult = await sendExpoPushNotifications(tokens.map((token) => ({
    to: token.expo_push_token,
    title,
    body: description,
    channelId: "content",
    sound: null,
    data: {
      notificationId: createdByUserId.get(token.user_id),
      teamId: input.teamId,
      type: input.kind,
      url: href,
      userId: token.user_id,
    },
  })));

  if (pushResult.invalidTokens.length > 0) {
    await admin.from("push_tokens").delete().in("expo_push_token", pushResult.invalidTokens);
  }

  return { notificationsCreated: createdRows.length, pushSent: pushResult.sent };
}
