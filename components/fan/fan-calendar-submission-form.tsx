"use client";

import Link from "next/link";
import { CalendarPlus, Loader2 } from "lucide-react";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { submitFanCalendarEventAction } from "@/app/fan/[teamSlug]/matches/actions";
import { FilterDropdown } from "@/components/match-filter-dropdown";
import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import {
  FAN_CALENDAR_SUBMISSION_DESCRIPTION_MAX_LENGTH,
  FAN_CALENDAR_SUBMISSION_SOURCE_URL_MAX_LENGTH,
  FAN_CALENDAR_SUBMISSION_TITLE_MAX_LENGTH,
  FAN_CALENDAR_SUBMISSION_TYPE_OPTIONS,
  type FanCalendarSubmissionType,
} from "@/lib/calendar/submissions";

type FanCalendarSubmissionFormProps = {
  teamId: string;
  teamSlug: string;
  teamName: string;
  isAuthenticated: boolean;
};

const controlClassName =
  "h-10 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[14px] font-normal text-[var(--ui-ink)] outline-none transition-colors placeholder:text-[var(--ui-muted)] focus:border-[var(--ui-ink)] disabled:cursor-wait disabled:opacity-60";

function todayKeyKST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function yearFromDateKey(dateKey: string) {
  return Number(dateKey.slice(0, 4));
}

export function FanCalendarSubmissionForm({
  teamId,
  teamSlug,
  teamName,
  isAuthenticated,
}: FanCalendarSubmissionFormProps) {
  const [pending, startTransition] = useTransition();
  const [eventType, setEventType] = useState<FanCalendarSubmissionType>("custom");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const dateRange = useMemo(() => {
    const today = todayKeyKST();
    return {
      today,
      max: `${yearFromDateKey(today) + 3}-12-31`,
    };
  }, []);

  function resetForm() {
    setEventType("custom");
    setTitle("");
    setEventDate("");
    setEventTime("");
    setIsRecurring(false);
    setDescription("");
    setSourceUrl("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const result = await submitFanCalendarEventAction({
        teamId,
        teamSlug,
        eventType,
        title,
        eventDate,
        eventTime,
        isRecurring,
        description,
        sourceUrl,
      });

      if (!result.ok) {
        const message = result.error ?? "일정 제보를 접수하지 못했어요.";
        setFeedback({ tone: "error", message });
        return;
      }

      const message = result.message ?? "운영진 확인 후 캘린더에 반영됩니다.";
      resetForm();
      setFeedback({ tone: "success", message });
    });
  }

  const trigger = (
    <span className="flex items-center justify-center gap-1.5">
      <CalendarPlus size={14} aria-hidden="true" />
      일정 제보
    </span>
  );

  return (
    <AdaptiveDialog
      title={`${teamName} 일정 제보`}
      trigger={trigger}
      triggerAriaLabel={`${teamName} 일정 제보하기`}
      triggerClassName="flex h-8 items-center justify-center px-2 text-[13px] font-medium text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-ink)]"
      panelClassName="sm:max-w-[420px]"
    >
      {!isAuthenticated ? (
        <div className="flex flex-col gap-3">
          <p className="text-[14px] font-normal text-[var(--ui-text)]">
            로그인 후 일정을 제보할 수 있습니다.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/fan/${teamSlug}/matches`)}`}
            className="flex h-10 items-center justify-center rounded-lg bg-[var(--ui-ink)] px-4 text-[14px] font-medium text-[var(--ui-surface)] transition-opacity hover:opacity-90"
          >
            로그인하고 제보하기
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm font-medium text-[var(--ui-text)]">일정 종류</span>
              <div className="[&>div]:w-full">
                <FilterDropdown
                  ariaLabel="일정 종류 선택"
                  options={FAN_CALENDAR_SUBMISSION_TYPE_OPTIONS}
                  selected={eventType}
                  onSelect={(value) => setEventType(value as FanCalendarSubmissionType)}
                  disabled={pending}
                  triggerClassName="h-10 min-h-10 !w-full justify-between rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 !text-[14px] !font-medium hover:bg-[var(--ui-card-hover)]"
                />
              </div>
            </div>

            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm font-medium text-[var(--ui-text)]">일정 제목</span>
              <input
                type="text"
                required
                maxLength={FAN_CALENDAR_SUBMISSION_TITLE_MAX_LENGTH}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={pending}
                placeholder="예: 팬 사인회, 창단 기념일"
                className={controlClassName}
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm font-medium text-[var(--ui-text)]">날짜</span>
              <input
                type="date"
                required
                min={isRecurring ? "1900-01-01" : dateRange.today}
                max={dateRange.max}
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                disabled={pending}
                className={controlClassName}
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm font-medium text-[var(--ui-text)]">시간 (선택)</span>
              <input
                type="time"
                value={eventTime}
                onChange={(event) => setEventTime(event.target.value)}
                disabled={pending}
                className={controlClassName}
              />
            </label>
          </div>

          <label className="flex h-10 items-center gap-2 rounded-lg border border-[var(--ui-border)] px-3">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(event) => setIsRecurring(event.target.checked)}
              disabled={pending}
              className="h-4 w-4 shrink-0 accent-[var(--ui-ink)]"
            />
            <span className="text-[14px] font-medium text-[var(--ui-text)]">매년 반복</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between gap-3 text-sm font-medium text-[var(--ui-text)]">
              상세 설명 (선택)
              <span className="text-[13px] font-normal tabular-nums text-[var(--ui-muted)]">
                {description.length}/{FAN_CALENDAR_SUBMISSION_DESCRIPTION_MAX_LENGTH}
              </span>
            </span>
            <textarea
              rows={2}
              maxLength={FAN_CALENDAR_SUBMISSION_DESCRIPTION_MAX_LENGTH}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={pending}
              placeholder="운영진이 확인할 수 있도록 일정 내용을 적어주세요."
              className={`${controlClassName} h-auto min-h-16 resize-y py-2 leading-[1.5]`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--ui-text)]">출처 URL</span>
            <input
              type="url"
              required
              inputMode="url"
              pattern="https://.*"
              maxLength={FAN_CALENDAR_SUBMISSION_SOURCE_URL_MAX_LENGTH}
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              disabled={pending}
              placeholder="https:// 공식 공지 또는 공개 게시물"
              className={controlClassName}
            />
          </label>

          {feedback ? (
            <p
              role={feedback.tone === "error" ? "alert" : "status"}
              className={`rounded-lg border px-3 py-2 text-[14px] font-normal ${
                feedback.tone === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {feedback.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--ui-ink)] px-4 text-[14px] font-medium text-[var(--ui-surface)] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
            {pending ? "접수하는 중…" : "제보하기"}
          </button>
        </form>
      )}
    </AdaptiveDialog>
  );
}
