import "server-only";

import { requireAdmin } from "@/lib/auth/admin";
import type { FanCalendarSubmissionType } from "@/lib/calendar/submissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FanCalendarSubmissionStatus = "pending" | "approved" | "rejected";

export type FanCalendarSubmissionAdminRow = {
  id: string;
  teamId: string;
  teamName: string;
  teamSlug: string;
  submittedBy: string | null;
  submitterName: string;
  eventType: FanCalendarSubmissionType;
  title: string;
  eventDate: string;
  eventTime: string | null;
  isRecurring: boolean;
  description: string | null;
  sourceUrl: string;
  status: FanCalendarSubmissionStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  publishedEventId: string | null;
  discordNotifiedAt: string | null;
  discordNotificationError: string | null;
  discordNotificationAttemptCount: number;
  discordNotificationLastAttemptAt: string | null;
  discordNotificationNextAttemptAt: string | null;
  createdAt: string;
};

type SubmissionRow = {
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
  status: FanCalendarSubmissionStatus;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  published_event_id: string | null;
  discord_notified_at: string | null;
  discord_notification_error: string | null;
  discord_notification_attempt_count: number;
  discord_notification_last_attempt_at: string | null;
  discord_notification_next_attempt_at: string | null;
  created_at: string;
};

type TeamRow = {
  id: string;
  name: string;
  short_name: string;
  slug: string;
  fan_site_host: string | null;
};

type ProfileRow = {
  id: string;
  nickname: string | null;
};

const SUBMISSION_SELECT =
  "id, team_id, submitted_by, event_type, title, event_date, event_time, is_recurring, description, source_url, status, review_note, reviewed_at, reviewed_by, published_event_id, discord_notified_at, discord_notification_error, discord_notification_attempt_count, discord_notification_last_attempt_at, discord_notification_next_attempt_at, created_at";

/** 비공개 제보 큐를 관리자 화면용 표시 데이터로 정규화한다. */
export async function listFanCalendarSubmissions(): Promise<FanCalendarSubmissionAdminRow[]> {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const [pendingResult, reviewedResult] = await Promise.all([
    supabase
      .from("fan_calendar_event_submissions")
      .select(SUBMISSION_SELECT)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(500),
    supabase
      .from("fan_calendar_event_submissions")
      .select(SUBMISSION_SELECT)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (pendingResult.error) throw pendingResult.error;
  if (reviewedResult.error) throw reviewedResult.error;
  const submissions = [
    ...((pendingResult.data ?? []) as SubmissionRow[]),
    ...((reviewedResult.data ?? []) as SubmissionRow[]),
  ];
  if (submissions.length === 0) return [];

  const teamIds = [...new Set(submissions.map((submission) => submission.team_id))];
  const profileIds = [
    ...new Set(
      submissions
        .flatMap((submission) => [submission.submitted_by, submission.reviewed_by])
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [teamResult, profileResult] = await Promise.all([
    supabase.from("teams").select("id, name, short_name, slug, fan_site_host").in("id", teamIds),
    profileIds.length > 0
      ? supabase.from("profiles").select("id, nickname").in("id", profileIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
  ]);

  if (teamResult.error) throw teamResult.error;
  if (profileResult.error) throw profileResult.error;

  const teamById = new Map(((teamResult.data ?? []) as TeamRow[]).map((team) => [team.id, team]));
  const nicknameById = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile.nickname]),
  );

  return submissions.map((submission) => {
    const team = teamById.get(submission.team_id);
    return {
      id: submission.id,
      teamId: submission.team_id,
      teamName: team?.short_name || team?.name || "알 수 없는 팀",
      teamSlug: team?.fan_site_host || team?.slug || "",
      submittedBy: submission.submitted_by,
      submitterName: submission.submitted_by
        ? nicknameById.get(submission.submitted_by) || "이름 없는 사용자"
        : "탈퇴한 사용자",
      eventType: submission.event_type,
      title: submission.title,
      eventDate: submission.event_date,
      eventTime: submission.event_time,
      isRecurring: submission.is_recurring,
      description: submission.description,
      sourceUrl: submission.source_url,
      status: submission.status,
      reviewNote: submission.review_note,
      reviewedAt: submission.reviewed_at,
      reviewerName: submission.reviewed_by
        ? nicknameById.get(submission.reviewed_by) || "관리자"
        : null,
      publishedEventId: submission.published_event_id,
      discordNotifiedAt: submission.discord_notified_at,
      discordNotificationError: submission.discord_notification_error,
      discordNotificationAttemptCount: submission.discord_notification_attempt_count,
      discordNotificationLastAttemptAt: submission.discord_notification_last_attempt_at,
      discordNotificationNextAttemptAt: submission.discord_notification_next_attempt_at,
      createdAt: submission.created_at,
    };
  });
}
