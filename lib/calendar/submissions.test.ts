import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fanCalendarSubmissionDateLabel,
  validateFanCalendarSubmission,
} from "./submissions.ts";
import {
  FAN_CALENDAR_NOTIFICATION_MAX_ATTEMPTS,
  fanCalendarNotificationNextAttemptAt,
} from "./submission-notifications.ts";

const now = new Date("2026-08-26T03:00:00.000Z");

test("팬 캘린더 제보 입력을 정규화한다", () => {
  const result = validateFanCalendarSubmission({
    teamId: "team-1",
    teamSlug: "t1",
    eventType: "custom",
    title: "  팬   미팅  ",
    eventDate: "2026-09-01",
    eventTime: "18:30",
    description: "  공개 방송 이후 진행  ",
    sourceUrl: "https://example.com/events/1",
  }, now);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.title, "팬 미팅");
  assert.equal(result.value.eventTime, "18:30");
  assert.equal(result.value.description, "공개 방송 이후 진행");
  assert.equal(result.value.sourceUrl, "https://example.com/events/1");
});

test("지난 일회성 일정은 거부하고 반복 기념일은 허용한다", () => {
  const oneTime = validateFanCalendarSubmission({
    teamId: "team-1",
    teamSlug: "t1",
    eventType: "custom",
    title: "지난 이벤트",
    eventDate: "2026-08-25",
    sourceUrl: "https://example.com/past",
  }, now);
  assert.equal(oneTime.ok, false);

  const recurring = validateFanCalendarSubmission({
    teamId: "team-1",
    teamSlug: "t1",
    eventType: "debut",
    title: "창단 기념일",
    eventDate: "2013-02-13",
    sourceUrl: "https://example.com/history",
    isRecurring: true,
  }, now);
  assert.equal(recurring.ok, true);
});

test("잘못된 날짜·시간·출처 URL을 거부한다", () => {
  for (const input of [
    { eventDate: "2026-02-30", eventTime: "18:30", sourceUrl: "https://example.com" },
    { eventDate: "2026-09-01", eventTime: "25:00", sourceUrl: "https://example.com" },
    { eventDate: "2026-09-01", eventTime: "18:30", sourceUrl: "javascript:alert(1)" },
    { eventDate: "2026-09-01", eventTime: "18:30", sourceUrl: "http://example.com/events/1" },
    { eventDate: "2026-09-01", eventTime: "18:30", sourceUrl: "https://user:pass@example.com" },
    { eventDate: "2026-09-01", eventTime: "18:30", sourceUrl: "https://localhost/events/1" },
    { eventDate: "2026-09-01", eventTime: "18:30", sourceUrl: "https://127.0.0.1/events/1" },
    { eventDate: "2026-09-01", eventTime: "18:30", sourceUrl: "https://calendar.internal/events/1" },
    { eventDate: "2026-09-01", eventTime: "18:30", sourceUrl: `https://example.com/${"가".repeat(170)}` },
  ]) {
    const result = validateFanCalendarSubmission({
      teamId: "team-1",
      teamSlug: "t1",
      eventType: "custom",
      title: "팬 이벤트",
      ...input,
    }, now);
    assert.equal(result.ok, false);
  }
});

test("런타임 입력 타입을 검증하고 truthy 문자열을 반복 일정으로 취급하지 않는다", () => {
  for (const input of [
    null,
    "invalid",
    {},
    {
      teamId: "team-1",
      teamSlug: "t1",
      eventType: "custom",
      title: "팬 이벤트",
      eventDate: "2026-09-01",
      sourceUrl: "https://example.com/events/1",
      isRecurring: "false",
    },
  ]) {
    assert.doesNotThrow(() => validateFanCalendarSubmission(input, now));
    assert.equal(validateFanCalendarSubmission(input, now).ok, false);
  }
});

test("제보 날짜 라벨에 종일과 시간을 구분한다", () => {
  assert.equal(fanCalendarSubmissionDateLabel("2026-09-01", null), "2026-09-01 · 종일");
  assert.equal(fanCalendarSubmissionDateLabel("2026-09-01", "18:30"), "2026-09-01 18:30");
});

test("Discord 재시도는 지수형 backoff와 Retry-After 중 긴 값을 따르고 최대 횟수에서 끝난다", () => {
  assert.equal(
    fanCalendarNotificationNextAttemptAt(1, null, now)?.toISOString(),
    "2026-08-26T03:01:00.000Z",
  );
  assert.equal(
    fanCalendarNotificationNextAttemptAt(2, 600, now)?.toISOString(),
    "2026-08-26T03:10:00.000Z",
  );
  assert.equal(
    fanCalendarNotificationNextAttemptAt(FAN_CALENDAR_NOTIFICATION_MAX_ATTEMPTS, 600, now),
    null,
  );
});
