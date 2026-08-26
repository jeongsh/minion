import "server-only";

import {
  FAN_CALENDAR_SUBMISSION_FOLLOW_DAYS,
  validateFanCalendarSubmission,
} from "@/lib/calendar/submissions";
import { attemptFanCalendarSubmissionNotification } from "@/lib/calendar/submission-notifications";
import { findProfanity } from "@/lib/community/content-filter";
import { isCommunityUserSanctioned } from "@/lib/data/community-users";
import { recordOperationalEvent } from "@/lib/observability/operational-events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FanCalendarSubmissionResult = {
  ok: boolean;
  error?: string;
  message?: string;
};

function submissionDatabaseError(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "같은 날짜와 제목으로 검토 중인 제보가 있어요.";
  const message = error.message ?? "";
  if (message.includes("CALENDAR_SUBMISSION_COOLDOWN")) return "잠시 후 다시 제보해 주세요.";
  if (message.includes("CALENDAR_SUBMISSION_DAILY_LIMIT")) return "일정 제보는 하루 3건까지 가능해요.";
  if (message.includes("CALENDAR_SUBMISSION_PENDING_LIMIT")) return "검토 중인 제보는 한 번에 3건까지 가능해요.";
  return "일정 제보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export async function createFanCalendarSubmission(
  rawInput: unknown,
  actor: { isAdmin: boolean; userId: string },
): Promise<FanCalendarSubmissionResult> {
  if (await isCommunityUserSanctioned(actor.userId)) {
    return { ok: false, error: "커뮤니티 이용이 제한된 계정은 일정을 제보할 수 없어요." };
  }

  const validation = validateFanCalendarSubmission(rawInput);
  if (!validation.ok) return validation;
  const input = validation.value;
  const supabase = createSupabaseAdminClient();
  const { data: team } = await supabase
    .from("teams")
    .select("id, slug, fan_site_host, short_name")
    .eq("id", input.teamId)
    .maybeSingle();
  if (!team || (input.teamSlug !== team.slug && input.teamSlug !== team.fan_site_host)) {
    return { ok: false, error: "팬페이지 팀 정보를 다시 확인해 주세요." };
  }

  if (!actor.isAdmin) {
    const { data: follow } = await supabase
      .from("team_fans")
      .select("created_at")
      .eq("team_id", team.id)
      .eq("user_id", actor.userId)
      .maybeSingle();
    if (!follow) return { ok: false, error: "이 팀을 팔로우한 뒤 일정을 제보할 수 있어요." };
    const followedFor = Date.now() - new Date(follow.created_at).getTime();
    if (followedFor < FAN_CALENDAR_SUBMISSION_FOLLOW_DAYS * 86_400_000) {
      return { ok: false, error: `팀을 팔로우한 지 ${FAN_CALENDAR_SUBMISSION_FOLLOW_DAYS}일이 지나면 제보할 수 있어요.` };
    }
  }

  if (findProfanity(`${input.title}\n${input.description ?? ""}`)) {
    return { ok: false, error: "금칙어가 포함되어 있어 내용을 등록할 수 없어요." };
  }

  const { data: submissionId, error } = await supabase.rpc("submit_fan_calendar_event_submission", {
    p_team_id: team.id,
    p_submitted_by: actor.userId,
    p_event_type: input.eventType,
    p_title: input.title,
    p_event_date: input.eventDate,
    p_event_time: input.eventTime,
    p_is_recurring: input.isRecurring,
    p_description: input.description,
    p_source_url: input.sourceUrl,
  });
  if (error || !submissionId) return { ok: false, error: submissionDatabaseError(error ?? {}) };

  const id = String(submissionId);
  await recordOperationalEvent(supabase, {
    eventType: "fan_calendar_submission_created",
    actorUserId: actor.userId,
    targetType: "fan_calendar_event_submission",
    targetId: id,
    metadata: { teamId: team.id, eventType: input.eventType, eventDate: input.eventDate },
  });
  await attemptFanCalendarSubmissionNotification(id, { supabase });
  return { ok: true, message: "일정 제보가 접수됐어요. 운영진 확인 후 캘린더에 반영됩니다." };
}
