import type { SupabaseClient } from "@supabase/supabase-js";

import { FAN_CALENDAR_SUBMISSION_TYPE_LABEL, type FanCalendarSubmissionType } from "./submissions.ts";
import {
  sendDiscordFanCalendarSubmissionAlert,
  type FanCalendarDiscordDeliveryErrorCode,
  type FanCalendarDiscordDeliveryResult,
} from "../notify/discord.ts";
import { recordOperationalEvent } from "../observability/operational-events.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

export const FAN_CALENDAR_NOTIFICATION_MAX_ATTEMPTS = 5;
export const FAN_CALENDAR_NOTIFICATION_CLAIM_LIMIT = 10;

const FAN_CALENDAR_NOTIFICATION_BACKOFF_SECONDS = [60, 300, 900, 3_600, 21_600] as const;

export type FanCalendarNotificationErrorCode =
  | FanCalendarDiscordDeliveryErrorCode
  | "not_configured"
  | "payload_error";

type FanCalendarSubmissionNotificationRow = {
  id: string;
  team_id: string;
  submitted_by: string | null;
  event_type: FanCalendarSubmissionType;
  title: string;
  event_date: string;
  event_time: string | null;
  is_recurring: boolean;
  description: string | null;
  source_url: string;
  status: "pending" | "approved" | "rejected";
  discord_notified_at: string | null;
  discord_notification_attempt_count: number;
};

type NotificationFailure = {
  ok: false;
  errorCode: FanCalendarNotificationErrorCode;
  retryable: boolean;
  retryAfterSeconds: number | null;
};

export type FanCalendarNotificationAttemptResult =
  | { status: "delivered"; attemptCount: number }
  | {
      status: "retry_scheduled";
      attemptCount: number;
      errorCode: FanCalendarNotificationErrorCode;
      nextAttemptAt: string;
    }
  | {
      status: "terminal_failure";
      attemptCount: number;
      errorCode: FanCalendarNotificationErrorCode;
    }
  | { status: "skipped"; reason: "already_notified" | "max_attempts" | "not_found" | "not_pending" | "state_changed" }
  | { status: "deferred"; reason: "load_failed" | "state_update_failed" };

export type FanCalendarNotificationProcessingSummary = {
  claimed: number;
  delivered: number;
  retryScheduled: number;
  terminalFailures: number;
  skipped: number;
  deferred: number;
};

type NotificationAttemptOptions = {
  supabase?: SupabaseClient;
  webhookUrl?: string | null;
  siteUrl?: string;
  now?: Date;
  fetchImpl?: typeof fetch;
};

function configuredWebhookUrl(override: string | null | undefined) {
  if (override !== undefined) return override?.trim() || null;
  return process.env.DISCORD_CALENDAR_WEBHOOK_URL?.trim()
    || process.env.DISCORD_COMMUNITY_WEBHOOK_URL?.trim()
    || null;
}

export function fanCalendarNotificationNextAttemptAt(
  completedAttemptCount: number,
  retryAfterSeconds: number | null,
  now: Date,
): Date | null {
  if (completedAttemptCount >= FAN_CALENDAR_NOTIFICATION_MAX_ATTEMPTS) return null;
  const backoffIndex = Math.max(0, Math.min(
    completedAttemptCount - 1,
    FAN_CALENDAR_NOTIFICATION_BACKOFF_SECONDS.length - 1,
  ));
  const backoffSeconds = FAN_CALENDAR_NOTIFICATION_BACKOFF_SECONDS[backoffIndex];
  const delaySeconds = Math.max(backoffSeconds, retryAfterSeconds ?? 0);
  return new Date(now.getTime() + delaySeconds * 1_000);
}

async function recordNotificationEvent(
  supabase: SupabaseClient,
  row: Pick<FanCalendarSubmissionNotificationRow, "id" | "submitted_by" | "team_id">,
  eventType: string,
  metadata: Record<string, unknown>,
) {
  try {
    await recordOperationalEvent(supabase, {
      eventType,
      actorUserId: row.submitted_by,
      targetType: "fan_calendar_event_submission",
      targetId: row.id,
      metadata: { teamId: row.team_id, ...metadata },
    });
  } catch {
    console.warn("[fan-calendar] notification audit write failed", {
      eventType,
      submissionId: row.id,
    });
  }
}

async function persistNotificationAttempt(
  supabase: SupabaseClient,
  row: FanCalendarSubmissionNotificationRow,
  delivery: FanCalendarDiscordDeliveryResult | NotificationFailure,
  attemptedAt: Date,
): Promise<FanCalendarNotificationAttemptResult> {
  const attemptCount = row.discord_notification_attempt_count + 1;
  const nextAttempt = !delivery.ok && delivery.retryable
    ? fanCalendarNotificationNextAttemptAt(attemptCount, delivery.retryAfterSeconds, attemptedAt)
    : null;
  const update = delivery.ok
    ? {
        discord_notified_at: attemptedAt.toISOString(),
        discord_notification_error: null,
        discord_notification_attempt_count: attemptCount,
        discord_notification_last_attempt_at: attemptedAt.toISOString(),
        discord_notification_next_attempt_at: null,
        updated_at: attemptedAt.toISOString(),
      }
    : {
        discord_notified_at: null,
        discord_notification_error: delivery.errorCode,
        discord_notification_attempt_count: attemptCount,
        discord_notification_last_attempt_at: attemptedAt.toISOString(),
        discord_notification_next_attempt_at: nextAttempt?.toISOString() ?? null,
        updated_at: attemptedAt.toISOString(),
      };

  try {
    const { data, error } = await supabase
      .from("fan_calendar_event_submissions")
      .update(update)
      .eq("id", row.id)
      .eq("status", "pending")
      .is("discord_notified_at", null)
      .eq("discord_notification_attempt_count", row.discord_notification_attempt_count)
      .select("id")
      .maybeSingle();

    if (error) {
      console.warn("[fan-calendar] notification state update failed", { submissionId: row.id });
      await recordNotificationEvent(supabase, row, "fan_calendar_submission_notification_state_update_failed", {
        attemptedDelivery: delivery.ok ? "success" : "failure",
      });
      return { status: "deferred", reason: "state_update_failed" };
    }
    if (!data) return { status: "skipped", reason: "state_changed" };
  } catch {
    console.warn("[fan-calendar] notification state update failed", { submissionId: row.id });
    await recordNotificationEvent(supabase, row, "fan_calendar_submission_notification_state_update_failed", {
      attemptedDelivery: delivery.ok ? "success" : "failure",
    });
    return { status: "deferred", reason: "state_update_failed" };
  }

  if (delivery.ok) return { status: "delivered", attemptCount };

  await recordNotificationEvent(supabase, row, "fan_calendar_submission_discord_failed", {
    attemptCount,
    errorCode: delivery.errorCode,
    retryScheduled: nextAttempt !== null,
  });
  if (nextAttempt) {
    return {
      status: "retry_scheduled",
      attemptCount,
      errorCode: delivery.errorCode,
      nextAttemptAt: nextAttempt.toISOString(),
    };
  }
  return { status: "terminal_failure", attemptCount, errorCode: delivery.errorCode };
}

async function payloadFailure(
  supabase: SupabaseClient,
  row: FanCalendarSubmissionNotificationRow,
  now: Date,
) {
  const failure: NotificationFailure = {
    ok: false,
    errorCode: "payload_error",
    retryable: true,
    retryAfterSeconds: null,
  };
  return persistNotificationAttempt(supabase, row, failure, now);
}

export async function attemptFanCalendarSubmissionNotification(
  submissionId: string,
  options: NotificationAttemptOptions = {},
): Promise<FanCalendarNotificationAttemptResult> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  let row: FanCalendarSubmissionNotificationRow | null = null;

  try {
    const { data, error } = await supabase
      .from("fan_calendar_event_submissions")
      .select(
        "id, team_id, submitted_by, event_type, title, event_date, event_time, is_recurring, description, source_url, status, discord_notified_at, discord_notification_attempt_count",
      )
      .eq("id", submissionId)
      .maybeSingle();
    if (error) {
      console.warn("[fan-calendar] notification load failed", { submissionId });
      return { status: "deferred", reason: "load_failed" };
    }
    row = data as FanCalendarSubmissionNotificationRow | null;
  } catch {
    console.warn("[fan-calendar] notification load failed", { submissionId });
    return { status: "deferred", reason: "load_failed" };
  }

  if (!row) return { status: "skipped", reason: "not_found" };
  if (row.status !== "pending") return { status: "skipped", reason: "not_pending" };
  if (row.discord_notified_at) return { status: "skipped", reason: "already_notified" };
  if (row.discord_notification_attempt_count >= FAN_CALENDAR_NOTIFICATION_MAX_ATTEMPTS) {
    return { status: "skipped", reason: "max_attempts" };
  }

  const attemptedAt = options.now ?? new Date();
  const webhookUrl = configuredWebhookUrl(options.webhookUrl);
  if (!webhookUrl) {
    return persistNotificationAttempt(supabase, row, {
      ok: false,
      errorCode: "not_configured",
      retryable: true,
      retryAfterSeconds: null,
    }, attemptedAt);
  }

  try {
    const teamPromise = supabase
      .from("teams")
      .select("short_name, slug, fan_site_host")
      .eq("id", row.team_id)
      .maybeSingle();
    const profilePromise = row.submitted_by
      ? supabase.from("profiles").select("nickname").eq("id", row.submitted_by).maybeSingle()
      : Promise.resolve({ data: null, error: null });
    const pendingCountPromise = supabase
      .from("fan_calendar_event_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    const [teamResult, profileResult, pendingCountResult] = await Promise.all([
      teamPromise,
      profilePromise,
      pendingCountPromise,
    ]);

    if (teamResult.error || !teamResult.data || profileResult.error) {
      return payloadFailure(supabase, row, attemptedAt);
    }

    const team = teamResult.data as { short_name: string; slug: string; fan_site_host: string | null };
    const profile = profileResult.data as { nickname: string | null } | null;
    const delivery = await sendDiscordFanCalendarSubmissionAlert(
      webhookUrl,
      {
        submissionId: row.id,
        teamName: team.short_name,
        teamSlug: team.fan_site_host || team.slug,
        requesterName: profile?.nickname ?? "팬",
        eventTypeLabel: FAN_CALENDAR_SUBMISSION_TYPE_LABEL[row.event_type],
        title: row.title,
        eventDate: row.event_date,
        eventTime: row.event_time ? row.event_time.slice(0, 5) : null,
        isRecurring: row.is_recurring,
        description: row.description,
        sourceUrl: row.source_url,
        pendingCount: pendingCountResult.error ? null : pendingCountResult.count,
      },
      options.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL,
      options.fetchImpl,
    );
    return persistNotificationAttempt(supabase, row, delivery, attemptedAt);
  } catch {
    return payloadFailure(supabase, row, attemptedAt);
  }
}

export async function processDueFanCalendarSubmissionNotifications(
  requestedLimit = FAN_CALENDAR_NOTIFICATION_CLAIM_LIMIT,
): Promise<FanCalendarNotificationProcessingSummary> {
  const supabase = createSupabaseAdminClient();
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit), 50));
  let claimData: unknown;

  try {
    const { data, error } = await supabase.rpc("claim_fan_calendar_submission_notifications", {
      p_limit: limit,
    });
    if (error) throw new Error("claim_failed");
    claimData = data;
  } catch {
    console.warn("[fan-calendar] notification claim failed");
    throw new Error("fan_calendar_notification_claim_failed");
  }

  const claimedIds = Array.isArray(claimData)
    ? claimData.flatMap((item) => {
        if (typeof item === "string") return [item];
        if (
          typeof item === "object"
          && item !== null
          && typeof (item as { submission_id?: unknown }).submission_id === "string"
        ) {
          return [(item as { submission_id: string }).submission_id];
        }
        return [];
      })
    : [];
  const summary: FanCalendarNotificationProcessingSummary = {
    claimed: claimedIds.length,
    delivered: 0,
    retryScheduled: 0,
    terminalFailures: 0,
    skipped: 0,
    deferred: 0,
  };

  for (const id of claimedIds) {
    const result = await attemptFanCalendarSubmissionNotification(id, { supabase });
    if (result.status === "delivered") summary.delivered += 1;
    else if (result.status === "retry_scheduled") summary.retryScheduled += 1;
    else if (result.status === "terminal_failure") summary.terminalFailures += 1;
    else if (result.status === "skipped") summary.skipped += 1;
    else summary.deferred += 1;
  }

  return summary;
}
