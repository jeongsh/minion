"use server";

import { revalidatePath, updateTag } from "next/cache";

import {
  createSupabaseAdminActionClient,
  createSupabaseAdminClient,
  requireAdmin,
} from "@/lib/auth/admin";
import { HOME_PUBLIC_DATA_TAG } from "@/lib/data/home-cache";
import { recordOperationalEvent } from "@/lib/observability/operational-events";

const REVIEW_NOTE_MAX_LENGTH = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CalendarSubmissionReviewInput = {
  submissionId: string;
  decision: "approved" | "rejected";
  reviewNote?: string;
};

export type CalendarSubmissionReviewResult = {
  ok: boolean;
  error?: string;
};

function revalidate() {
  revalidatePath("/admin/calendar");
  revalidatePath("/");
  updateTag(HOME_PUBLIC_DATA_TAG);
}

function revalidateSubmissionReview(teamSlug: string) {
  revalidate();
  if (!teamSlug) return;
  revalidatePath(`/fan/${teamSlug}`);
  revalidatePath(`/fan/${teamSlug}/matches`);
}

function approvalErrorMessage(error: { message?: string }) {
  const message = error.message ?? "";
  if (message.includes("CALENDAR_SUBMISSION_NOT_FOUND")) return "제보를 찾을 수 없어요.";
  if (message.includes("CALENDAR_SUBMISSION_NOT_PENDING")) return "이미 처리된 제보예요.";
  return "제보를 승인하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function parseFields(formData: FormData) {
  const eventType = String(formData.get("event_type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const teamId = (formData.get("team_id") as string | null)?.trim() || null;
  const playerId = (formData.get("player_id") as string | null)?.trim() || null;
  const isRecurring = formData.has("is_recurring");
  return { eventType, title, eventDate, teamId, playerId, isRecurring };
}

export async function createCalendarEventAction(formData: FormData) {
  const { eventType, title, eventDate, teamId, playerId, isRecurring } = parseFields(formData);
  if (!eventType || !title || !eventDate) return;

  const supabase = await createSupabaseAdminActionClient();
  await supabase.from("fan_calendar_events").insert({
    event_type: eventType,
    title,
    event_date: eventDate,
    team_id: teamId,
    player_id: playerId,
    is_recurring: isRecurring,
  });

  revalidate();
}

export async function updateCalendarEventAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const { eventType, title, eventDate, teamId, playerId, isRecurring } = parseFields(formData);
  if (!id || !eventType || !title || !eventDate) return;

  const supabase = await createSupabaseAdminActionClient();
  await supabase
    .from("fan_calendar_events")
    .update({
      event_type: eventType,
      title,
      event_date: eventDate,
      team_id: teamId,
      player_id: playerId,
      is_recurring: isRecurring,
    })
    .eq("id", id);

  revalidate();
}

export async function deleteCalendarEventAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createSupabaseAdminActionClient();
  await supabase.from("fan_calendar_events").delete().eq("id", id);

  revalidate();
}

/** 대기 중인 제보만 승인 또는 반려한다. 승인은 RPC에서 공개 일정 생성까지 원자적으로 처리한다. */
export async function reviewFanCalendarSubmissionAction(
  input: CalendarSubmissionReviewInput,
): Promise<CalendarSubmissionReviewResult> {
  if (!input || typeof input.submissionId !== "string") {
    return { ok: false, error: "제보 정보를 확인하지 못했어요." };
  }
  const submissionId = input.submissionId.trim();
  const reviewNote = typeof input.reviewNote === "string" ? input.reviewNote.trim() || null : null;
  if (!UUID_PATTERN.test(submissionId)) return { ok: false, error: "제보 정보를 확인하지 못했어요." };
  if (input.decision !== "approved" && input.decision !== "rejected") {
    return { ok: false, error: "검토 결과를 다시 선택해 주세요." };
  }
  if (reviewNote && reviewNote.length > REVIEW_NOTE_MAX_LENGTH) {
    return { ok: false, error: `검토 메모는 ${REVIEW_NOTE_MAX_LENGTH}자까지 입력할 수 있어요.` };
  }

  const admin = await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const { data: submission, error: submissionError } = await supabase
    .from("fan_calendar_event_submissions")
    .select("id, team_id, status")
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError) return { ok: false, error: "제보 정보를 불러오지 못했어요." };
  if (!submission) return { ok: false, error: "제보를 찾을 수 없어요." };
  if (submission.status !== "pending") return { ok: false, error: "이미 처리된 제보예요." };

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("slug, fan_site_host")
    .eq("id", submission.team_id)
    .maybeSingle();
  if (teamError || !team) return { ok: false, error: "제보 대상 팀 정보를 불러오지 못했어요." };
  const teamSlug = team.fan_site_host || team.slug;

  let publishedEventId: string | null = null;
  if (input.decision === "approved") {
    const { data, error } = await supabase.rpc("approve_fan_calendar_event_submission", {
      p_submission_id: submissionId,
      p_reviewed_by: admin.id,
      p_review_note: reviewNote,
    });
    if (error || !data) return { ok: false, error: approvalErrorMessage(error ?? {}) };
    publishedEventId = String(data);
  } else {
    const { data, error } = await supabase
      .from("fan_calendar_event_submissions")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
        review_note: reviewNote,
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: "제보를 반려하지 못했어요. 잠시 후 다시 시도해 주세요." };
    if (!data) return { ok: false, error: "다른 관리자가 이미 처리한 제보예요." };
  }

  await recordOperationalEvent(supabase, {
    eventType: input.decision === "approved"
      ? "fan_calendar_submission_approved"
      : "fan_calendar_submission_rejected",
    actorUserId: admin.id,
    targetType: "fan_calendar_event_submission",
    targetId: submissionId,
    metadata: {
      teamId: submission.team_id,
      publishedEventId,
      reviewNote,
    },
  });

  revalidateSubmissionReview(teamSlug);
  return { ok: true };
}
