import type { CalendarEventType } from "@/lib/calendar/events";

export const FAN_CALENDAR_SUBMISSION_DAILY_LIMIT = 3;
export const FAN_CALENDAR_SUBMISSION_PENDING_LIMIT = 3;
export const FAN_CALENDAR_SUBMISSION_FOLLOW_DAYS = 7;
export const FAN_CALENDAR_SUBMISSION_TITLE_MAX_LENGTH = 80;
export const FAN_CALENDAR_SUBMISSION_DESCRIPTION_MAX_LENGTH = 500;
export const FAN_CALENDAR_SUBMISSION_SOURCE_URL_MAX_LENGTH = 500;

export type FanCalendarSubmissionType = Exclude<CalendarEventType, "birthday">;

export const FAN_CALENDAR_SUBMISSION_TYPE_OPTIONS: Array<{
  value: FanCalendarSubmissionType;
  label: string;
}> = [
  { value: "custom", label: "일정·이벤트" },
  { value: "debut", label: "데뷔 기념일" },
  { value: "championship", label: "우승 기념일" },
];

export const FAN_CALENDAR_SUBMISSION_TYPE_LABEL: Record<FanCalendarSubmissionType, string> = {
  custom: "일정·이벤트",
  debut: "데뷔 기념일",
  championship: "우승 기념일",
};

export type FanCalendarSubmissionInput = {
  teamId: string;
  teamSlug: string;
  eventType: string;
  title: string;
  eventDate: string;
  eventTime?: string | null;
  description?: string | null;
  sourceUrl: string;
  isRecurring?: boolean;
};

export type ValidatedFanCalendarSubmission = {
  teamId: string;
  teamSlug: string;
  eventType: FanCalendarSubmissionType;
  title: string;
  eventDate: string;
  eventTime: string | null;
  description: string | null;
  sourceUrl: string;
  isRecurring: boolean;
};

export type FanCalendarSubmissionValidationResult =
  | { ok: true; value: ValidatedFanCalendarSubmission }
  | { ok: false; error: string };

function normalizeSingleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRealDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function todayKeyKST(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function normalizeEventTime(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${match[1]}:${match[2]}`;
}

export function normalizeFanCalendarSourceUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > FAN_CALENDAR_SUBMISSION_SOURCE_URL_MAX_LENGTH) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;

    const hostname = url.hostname.toLowerCase();
    const labels = hostname.split(".");
    const blockedSuffixes = new Set([
      "example",
      "home",
      "internal",
      "invalid",
      "lan",
      "local",
      "localdomain",
      "localhost",
      "onion",
      "test",
    ]);
    if (
      hostname.length > 253
      || labels.length < 2
      || blockedSuffixes.has(labels.at(-1) ?? "")
      || /^\d+(?:\.\d+){3}$/.test(hostname)
      || labels.some((label) => (
        label.length === 0
        || label.length > 63
        || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
      ))
    ) {
      return null;
    }

    const normalized = url.toString();
    return normalized.length <= FAN_CALENDAR_SUBMISSION_SOURCE_URL_MAX_LENGTH ? normalized : null;
  } catch {
    return null;
  }
}

export function validateFanCalendarSubmission(
  input: unknown,
  now: Date = new Date(),
): FanCalendarSubmissionValidationResult {
  if (!isRecord(input)) return { ok: false, error: "제보 내용을 다시 확인해 주세요." };

  const rawTeamId = input.teamId;
  const rawTeamSlug = input.teamSlug;
  const rawEventType = input.eventType;
  const rawTitle = input.title;
  const rawEventDate = input.eventDate;
  const rawEventTime = input.eventTime;
  const rawDescription = input.description;
  const rawSourceUrl = input.sourceUrl;
  const rawIsRecurring = input.isRecurring;
  if (
    typeof rawTeamId !== "string"
    || typeof rawTeamSlug !== "string"
    || typeof rawEventType !== "string"
    || typeof rawTitle !== "string"
    || typeof rawEventDate !== "string"
    || typeof rawSourceUrl !== "string"
  ) {
    return { ok: false, error: "제보 내용을 다시 확인해 주세요." };
  }
  if (
    (rawEventTime !== undefined && rawEventTime !== null && typeof rawEventTime !== "string")
    || (rawDescription !== undefined && rawDescription !== null && typeof rawDescription !== "string")
    || (rawIsRecurring !== undefined && typeof rawIsRecurring !== "boolean")
  ) {
    return { ok: false, error: "제보 내용을 다시 확인해 주세요." };
  }

  const teamId = rawTeamId.trim();
  const teamSlug = rawTeamSlug.trim();
  if (!teamId || !teamSlug) return { ok: false, error: "팀 정보를 확인하지 못했어요." };

  const allowedTypes = new Set(FAN_CALENDAR_SUBMISSION_TYPE_OPTIONS.map((option) => option.value));
  if (!allowedTypes.has(rawEventType as FanCalendarSubmissionType)) {
    return { ok: false, error: "제보 종류를 다시 선택해 주세요." };
  }

  const title = normalizeSingleLine(rawTitle);
  if (title.length < 2) return { ok: false, error: "일정 제목을 두 글자 이상 입력해 주세요." };
  if (title.length > FAN_CALENDAR_SUBMISSION_TITLE_MAX_LENGTH) {
    return { ok: false, error: `일정 제목은 ${FAN_CALENDAR_SUBMISSION_TITLE_MAX_LENGTH}자까지 입력할 수 있어요.` };
  }

  const eventDate = rawEventDate.trim();
  if (!isRealDateKey(eventDate)) return { ok: false, error: "올바른 날짜를 입력해 주세요." };

  const isRecurring = rawIsRecurring === true;
  const year = Number(eventDate.slice(0, 4));
  const maxYear = Number(todayKeyKST(now).slice(0, 4)) + 3;
  if (year < 1900 || year > maxYear) {
    return { ok: false, error: `날짜는 1900년부터 ${maxYear}년 사이로 입력해 주세요.` };
  }
  if (!isRecurring && eventDate < todayKeyKST(now)) {
    return { ok: false, error: "이미 지난 일회성 일정은 제보할 수 없어요." };
  }

  const eventTimeInput = typeof rawEventTime === "string" ? rawEventTime.trim() : "";
  const eventTime = normalizeEventTime(eventTimeInput);
  if (eventTimeInput && !eventTime) return { ok: false, error: "올바른 시간을 입력해 주세요." };

  const description = typeof rawDescription === "string" ? rawDescription.trim() || null : null;
  if (description && description.length > FAN_CALENDAR_SUBMISSION_DESCRIPTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `설명은 ${FAN_CALENDAR_SUBMISSION_DESCRIPTION_MAX_LENGTH}자까지 입력할 수 있어요.`,
    };
  }

  const sourceUrl = normalizeFanCalendarSourceUrl(rawSourceUrl);
  if (!sourceUrl) return { ok: false, error: "확인 가능한 공개 HTTPS 출처 주소를 입력해 주세요." };

  return {
    ok: true,
    value: {
      teamId,
      teamSlug,
      eventType: rawEventType as FanCalendarSubmissionType,
      title,
      eventDate,
      eventTime,
      description,
      sourceUrl,
      isRecurring,
    },
  };
}

export function fanCalendarSubmissionDateLabel(eventDate: string, eventTime: string | null) {
  return `${eventDate}${eventTime ? ` ${eventTime}` : " · 종일"}`;
}
