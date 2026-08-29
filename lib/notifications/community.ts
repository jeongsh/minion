import "server-only";

import { after } from "next/server";

import type { AppNotification } from "@/lib/notifications";
import {
  communityNotificationRecipients,
  notificationOwnerKey,
  type NotificationOwner,
} from "@/lib/notifications/community-recipients";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NotificationRecipient = NotificationOwner;

type NotificationRow = {
  id: string;
  title: string;
  description: string;
  href: string;
  created_at: string;
  read_at: string | null;
};

export type CommunityAppNotification = AppNotification & { kind: "post_activity" };

function recipientKey(recipient: NotificationRecipient) {
  return notificationOwnerKey(recipient);
}

function recipientColumns(recipient: NotificationRecipient) {
  return recipient.userId
    ? { recipient_user_id: recipient.userId, recipient_guest_key: null }
    : { recipient_user_id: null, recipient_guest_key: recipient.guestKey! };
}

function applyRecipientFilter<T>(query: T, recipient: NotificationRecipient): T {
  const filterable = query as T & { eq: (column: string, value: string) => T };
  return recipient.userId
    ? filterable.eq("recipient_user_id", recipient.userId)
    : filterable.eq("recipient_guest_key", recipient.guestKey!);
}

function toAppNotification(row: NotificationRow): CommunityAppNotification {
  return {
    id: `community:${row.id}`,
    kind: "post_activity",
    title: row.title,
    description: row.description,
    href: row.href,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function listCommunityNotifications(recipient: NotificationRecipient): Promise<CommunityAppNotification[]> {
  const query = createSupabaseAdminClient()
    .from("community_notifications")
    .select("id, title, description, href, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const { data, error } = await applyRecipientFilter(query, recipient);
  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(toAppNotification);
}

export async function markCommunityNotificationRead(recipient: NotificationRecipient, notificationId?: string) {
  let query = createSupabaseAdminClient()
    .from("community_notifications")
    .update({ read_at: new Date().toISOString() });
  query = applyRecipientFilter(query, recipient);
  if (notificationId) query = query.eq("id", notificationId);
  else query = query.is("read_at", null);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteCommunityNotifications(recipient: NotificationRecipient, notificationId?: string) {
  let query = applyRecipientFilter(
    createSupabaseAdminClient().from("community_notifications").delete(),
    recipient,
  );
  if (notificationId) query = query.eq("id", notificationId);
  const { error } = await query;
  if (error) throw error;
}

async function createCommunityCommentNotifications(input: {
  actor: NotificationRecipient;
  actorName?: string;
  commentId: string;
  parentId: string | null;
  postId: string;
}) {
  const admin = createSupabaseAdminClient();
  const [postResult, parentResult, actorProfileResult] = await Promise.all([
    admin.from("community_posts").select("author_id, guest_key, site_scope, team_id").eq("id", input.postId).maybeSingle(),
    input.parentId
      ? admin.from("community_comments").select("author_id, guest_key").eq("id", input.parentId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    input.actor.userId
      ? admin.from("profiles").select("nickname").eq("id", input.actor.userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (postResult.error) throw postResult.error;
  if (parentResult.error) throw parentResult.error;
  if (actorProfileResult.error) throw actorProfileResult.error;
  if (!postResult.data) return;

  const post = postResult.data as { author_id: string | null; guest_key: string | null; site_scope: string; team_id: string | null };
  const parent = parentResult.data as { author_id: string | null; guest_key: string | null } | null;
  const actorName = input.actorName ?? actorProfileResult.data?.nickname ?? "회원";
  let href = `/community/post/${input.postId}`;
  if (post.site_scope === "fan" && post.team_id) {
    const { data: team, error } = await admin.from("teams").select("fan_site_host").eq("id", post.team_id).maybeSingle();
    if (error) throw error;
    if (team?.fan_site_host) href = `/fan/${team.fan_site_host}/community/post/${input.postId}`;
  }

  const recipients = communityNotificationRecipients({
    actor: input.actor,
    postOwner: post.author_id ? { userId: post.author_id } : post.guest_key ? { guestKey: post.guest_key } : null,
    parentOwner: parent?.author_id ? { userId: parent.author_id } : parent?.guest_key ? { guestKey: parent.guest_key } : null,
  });
  if (recipients.length === 0) return;

  const recipientUserIds = recipients.flatMap(({ recipient }) => recipient.userId ? [recipient.userId] : []);
  const enabledUserIds = new Set(recipientUserIds);
  if (recipientUserIds.length > 0) {
    const { data: preferences, error } = await admin
      .from("user_notification_preferences")
      .select("user_id, in_app_enabled, community_enabled")
      .in("user_id", recipientUserIds);
    if (error) throw error;
    const preferencesByUserId = new Map((preferences ?? []).map((preference) => [preference.user_id, preference]));
    for (const userId of recipientUserIds) {
      const preference = preferencesByUserId.get(userId);
      if (preference && (!preference.in_app_enabled || !preference.community_enabled)) enabledUserIds.delete(userId);
    }
  }

  const rows = recipients.filter(({ recipient }) => (
    !recipient.userId || enabledUserIds.has(recipient.userId)
  )).map(({ recipient, kind }) => ({
    ...recipientColumns(recipient),
    actor_user_id: input.actor.userId ?? null,
    actor_name: actorName,
    kind,
    post_id: input.postId,
    comment_id: input.commentId,
    title: kind === "comment_reply" ? "내 댓글에 새 답글" : "내 글에 새 댓글",
    description: `${actorName}님이 ${kind === "comment_reply" ? "답글" : "댓글"}을 남겼어요.`,
    href,
    dedupe_key: `${input.commentId}:${recipientKey(recipient)}`,
  }));
  if (rows.length === 0) return;
  const { error } = await admin.from("community_notifications").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw error;
}

export function scheduleCommunityCommentNotifications(input: Parameters<typeof createCommunityCommentNotifications>[0]) {
  after(() => createCommunityCommentNotifications(input).catch((error) => {
    console.error("[community-notifications] failed to create comment notification", error);
  }));
}
