import "server-only";

import { after } from "next/server";

import type { BoardScope } from "@/lib/community/boards";
import { communityPostHref } from "@/lib/notifications/community";
import { sendExpoPushNotifications } from "@/lib/notify/push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminModerationTarget = "post" | "comment" | "user" | "guest";

const TARGET_LABELS: Record<AdminModerationTarget, string> = {
  comment: "댓글",
  guest: "비회원",
  post: "글",
  user: "사용자",
};

export type AdminModerationNotificationInput = {
  kind: "admin_report" | "admin_block";
  target: AdminModerationTarget;
  actor: { userId?: string | null; guestKey?: string | null };
  /** 같은 신고·차단으로 운영자 알림이 두 번 생기지 않게 하는 키. */
  dedupeKey: string;
  postId?: string | null;
  commentId?: string | null;
  targetUserId?: string | null;
  reason?: string | null;
};

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

/**
 * 신고·차단 발생 시 운영자에게 인앱 알림을 남긴다.
 * 알림함 행은 앱 알림 API에서만 노출하고, 푸시는 iOS 토큰에만 보낸다.
 */
async function createAdminModerationNotifications(input: AdminModerationNotificationInput) {
  const admin = createSupabaseAdminClient();
  const { data: adminIds, error: adminError } = await admin.rpc("community_admin_user_ids", { p_emails: adminEmails() });
  if (adminError) throw adminError;
  const recipientIds = ((adminIds ?? []) as string[]).filter((id) => id !== input.actor.userId);
  if (recipientIds.length === 0) return;

  let postId = input.postId ?? null;
  if (!postId && input.commentId) {
    const { data, error } = await admin.from("community_comments").select("post_id").eq("id", input.commentId).maybeSingle();
    if (error) throw error;
    postId = data?.post_id ?? null;
  }
  const [postResult, actorResult] = await Promise.all([
    postId
      ? admin.from("community_posts").select("site_scope, team_id").eq("id", postId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    input.actor.userId
      ? admin.from("profiles").select("nickname").eq("id", input.actor.userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (postResult.error) throw postResult.error;
  if (actorResult.error) throw actorResult.error;

  const post = postResult.data as { site_scope: BoardScope; team_id: string | null } | null;
  const href = postId && post
    ? await communityPostHref(postId, post)
    : input.targetUserId ? `/community/user/${input.targetUserId}` : "/community";
  const actorName = actorResult.data?.nickname ?? (input.actor.userId ? "회원" : "비회원");
  const targetLabel = TARGET_LABELS[input.target];
  const title = `${targetLabel} ${input.kind === "admin_report" ? "신고" : "차단"}`;
  const reason = input.reason?.trim().replace(/\s+/g, " ").slice(0, 80);
  const description = input.kind === "admin_report"
    ? `${actorName}님 신고${reason ? ` · ${reason}` : ""}`
    : `${actorName}님이 ${input.target === "guest" ? "비회원을" : "사용자를"} 차단했어요.`;

  const { data: createdRows, error } = await admin
    .from("community_notifications")
    .upsert(recipientIds.map((recipientId) => ({
      recipient_user_id: recipientId,
      recipient_guest_key: null,
      actor_user_id: input.actor.userId ?? null,
      actor_name: actorName,
      kind: input.kind,
      post_id: postId,
      comment_id: input.commentId ?? null,
      title,
      description,
      href,
      dedupe_key: `${input.dedupeKey}:${recipientId}`,
    })), { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id, recipient_user_id");
  if (error) throw error;

  const createdByUserId = new Map(
    ((createdRows ?? []) as { id: string; recipient_user_id: string }[]).map((row) => [row.recipient_user_id, row.id]),
  );
  if (createdByUserId.size === 0) return;

  const { data: tokens, error: tokenError } = await admin
    .from("push_tokens")
    .select("user_id, expo_push_token")
    .eq("platform", "ios")
    .in("user_id", [...createdByUserId.keys()]);
  if (tokenError) throw tokenError;

  const pushResult = await sendExpoPushNotifications((tokens ?? []).flatMap((token) => {
    const notificationId = createdByUserId.get(token.user_id);
    if (!notificationId) return [];
    return [{
      to: token.expo_push_token,
      title,
      body: description,
      channelId: "community" as const,
      sound: "default" as const,
      data: { notificationId, type: "post_activity", url: href, userId: token.user_id },
    }];
  }));

  if (pushResult.invalidTokens.length > 0) {
    const { error: deleteError } = await admin.from("push_tokens").delete().in("expo_push_token", pushResult.invalidTokens);
    if (deleteError) throw deleteError;
  }
}

export function scheduleAdminModerationNotifications(input: AdminModerationNotificationInput) {
  after(() => createAdminModerationNotifications(input).catch((error) => {
    console.error("[admin-moderation-notifications] failed to create notification", error);
  }));
}
