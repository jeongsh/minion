import "server-only";

import type { AppNotification } from "@/lib/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamContentNotificationRow = {
  id: string;
  kind: "team_video" | "team_social";
  title: string;
  description: string;
  href: string;
  image_url: string | null;
  created_at: string;
  read_at: string | null;
};

export type TeamContentAppNotification = AppNotification & { kind: "team_video" | "team_social" };

function toAppNotification(row: TeamContentNotificationRow): TeamContentAppNotification {
  return {
    id: `content:${row.id}`,
    kind: row.kind,
    title: row.title,
    description: row.description,
    href: row.href,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function listTeamContentNotifications(userId: string): Promise<TeamContentAppNotification[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("team_content_notifications")
    .select("id, kind, title, description, href, image_url, created_at, read_at")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as TeamContentNotificationRow[]).map(toAppNotification);
}

export async function markTeamContentNotificationRead(userId: string, notificationId?: string) {
  let query = createSupabaseAdminClient()
    .from("team_content_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", userId);
  if (notificationId) query = query.eq("id", notificationId);
  else query = query.is("read_at", null);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteTeamContentNotifications(userId: string, notificationId?: string) {
  let query = createSupabaseAdminClient()
    .from("team_content_notifications")
    .delete()
    .eq("recipient_user_id", userId);
  if (notificationId) query = query.eq("id", notificationId);
  const { error } = await query;
  if (error) throw error;
}
