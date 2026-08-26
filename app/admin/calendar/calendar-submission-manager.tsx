"use client";

import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  FanCalendarSubmissionAdminRow,
  FanCalendarSubmissionStatus,
} from "@/lib/calendar/submission-admin";
import { FAN_CALENDAR_SUBMISSION_TYPE_LABEL } from "@/lib/calendar/submissions";

import { reviewFanCalendarSubmissionAction } from "./actions";

const REVIEW_NOTE_MAX_LENGTH = 500;

const DISCORD_ERROR_LABEL: Record<string, string> = {
  client_error: "Discord 요청 거부",
  network: "네트워크 오류",
  not_configured: "웹훅 미설정",
  payload_error: "알림 데이터 오류",
  rate_limited: "Discord 전송 제한",
  server_error: "Discord 서버 오류",
  timeout: "응답 시간 초과",
};

const STATUS_META: Record<
  FanCalendarSubmissionStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "검토 대기",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  approved: {
    label: "승인됨",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    label: "반려됨",
    className: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300",
  },
};

function formatKST(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function eventDateLabel(submission: FanCalendarSubmissionAdminRow) {
  const time = submission.eventTime?.slice(0, 5);
  return `${submission.eventDate} · ${time || "종일"}${submission.isRecurring ? " · 매년 반복" : ""}`;
}

function DiscordStatus({ submission }: { submission: FanCalendarSubmissionAdminRow }) {
  if (submission.discordNotificationError) {
    const retryScheduled = submission.status === "pending" && Boolean(submission.discordNotificationNextAttemptAt);
    const errorLabel = DISCORD_ERROR_LABEL[submission.discordNotificationError] ?? "알 수 없는 오류";
    return (
      <div className={`rounded-lg border px-3 py-2 ${
        retryScheduled
          ? "border-amber-500/25 bg-amber-500/8"
          : "border-red-500/25 bg-red-500/8"
      }`}>
        <p className={`flex items-center gap-1.5 text-[13px] font-medium ${
          retryScheduled ? "text-amber-700 dark:text-amber-300" : "text-red-600 dark:text-red-300"
        }`}>
          {retryScheduled ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <XCircle size={14} aria-hidden="true" />}
          {retryScheduled ? "Discord 자동 재전송 대기" : "Discord 전송 중단"}
        </p>
        <p className="mt-1 text-[13px] font-medium leading-relaxed text-[var(--ui-muted)]">
          {errorLabel} · {submission.discordNotificationAttemptCount}회 시도
          {retryScheduled && submission.discordNotificationNextAttemptAt
            ? ` · ${formatKST(submission.discordNotificationNextAttemptAt)} 재시도`
            : ""}
        </p>
      </div>
    );
  }

  if (submission.discordNotifiedAt) {
    return (
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-300">
        <CheckCircle2 size={14} aria-hidden="true" />
        Discord 전송 완료 · {formatKST(submission.discordNotifiedAt)}
      </p>
    );
  }

  if (submission.discordNotificationNextAttemptAt) {
    return (
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ui-muted)]">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        Discord 전송 대기 · {formatKST(submission.discordNotificationNextAttemptAt)}까지 자동 회수
      </p>
    );
  }

  return <p className="text-[13px] font-medium text-[var(--ui-muted)]">Discord 전송 기록 없음</p>;
}

function SubmissionCard({ submission }: { submission: FanCalendarSubmissionAdminRow }) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState(submission.reviewNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const status = STATUS_META[submission.status];

  function review(decision: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const result = await reviewFanCalendarSubmissionAction({
        submissionId: submission.id,
        decision,
        reviewNote,
      });
      if (!result.ok) {
        setError(result.error ?? "제보를 처리하지 못했어요.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <article className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--ui-surface-muted)] px-2.5 py-1 text-[13px] font-medium text-[var(--ui-text)]">
                {submission.teamName}
              </span>
              <span className="text-[13px] font-medium text-[var(--ui-muted)]">
                {FAN_CALENDAR_SUBMISSION_TYPE_LABEL[submission.eventType]}
              </span>
            </div>
            <h3 className="break-words text-base font-bold leading-snug text-[var(--ui-ink)]">
              {submission.title}
            </h3>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[13px] font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>

        <div className="grid gap-2 text-[13px] font-medium text-[var(--ui-muted)] sm:grid-cols-2">
          <p>{eventDateLabel(submission)}</p>
          <p className="sm:text-right">
            제보자 {submission.submitterName} · {formatKST(submission.createdAt)}
          </p>
        </div>

        {submission.description ? (
          <p className="whitespace-pre-wrap break-words text-base font-normal leading-relaxed text-[var(--ui-text)]">
            {submission.description}
          </p>
        ) : null}

        <a
          href={submission.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex min-h-10 items-center gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2 text-[14px] font-medium text-[var(--ui-text)] transition-colors hover:text-[var(--ui-ink)]"
        >
          <ExternalLink size={15} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-all">출처 확인 · {submission.sourceUrl}</span>
        </a>

        <DiscordStatus submission={submission} />

        {submission.status === "pending" ? (
          <div className="flex flex-col gap-3 border-t border-[var(--ui-border)] pt-4">
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-medium text-[var(--ui-text)]">검토 메모 (선택)</span>
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                maxLength={REVIEW_NOTE_MAX_LENGTH}
                rows={3}
                placeholder="승인 또는 반려 근거를 남겨 주세요."
                className="resize-y rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5 text-base font-normal leading-relaxed text-[var(--ui-ink)] outline-none transition-colors placeholder:text-[var(--ui-muted)] focus:border-[var(--ui-muted)]"
              />
              <span className="text-right text-[13px] font-medium text-[var(--ui-muted)]">
                {reviewNote.length}/{REVIEW_NOTE_MAX_LENGTH}자
              </span>
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={pending}
                onClick={() => review("approved")}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50"
              >
                {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                승인하고 공개
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => review("rejected")}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-red-500/35 bg-red-500/8 px-4 text-[14px] font-medium text-red-600 transition-colors hover:bg-red-500/15 disabled:cursor-wait disabled:opacity-50 dark:text-red-300"
              >
                반려
              </button>
            </div>

            {error ? (
              <p role="alert" className="text-[13px] font-medium leading-relaxed text-red-500">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="border-t border-[var(--ui-border)] pt-3 text-[13px] font-medium leading-relaxed text-[var(--ui-muted)]">
            <p>
              {submission.reviewerName ?? "관리자"} · {submission.reviewedAt ? formatKST(submission.reviewedAt) : "처리 시각 없음"}
            </p>
            {submission.reviewNote ? <p className="mt-1 whitespace-pre-wrap">검토 메모 · {submission.reviewNote}</p> : null}
          </div>
        )}
      </div>
    </article>
  );
}

export function CalendarSubmissionManager({
  submissions,
}: {
  submissions: FanCalendarSubmissionAdminRow[];
}) {
  const pendingSubmissions = submissions.filter((submission) => submission.status === "pending");
  const reviewedSubmissions = submissions.filter((submission) => submission.status !== "pending");

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3" aria-labelledby="pending-calendar-submissions">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="pending-calendar-submissions" className="text-[18px] font-bold text-[var(--ui-ink)]">
            검토 대기
          </h3>
          <span className="text-[13px] font-medium text-[var(--ui-muted)]">{pendingSubmissions.length}건</span>
        </div>
        {pendingSubmissions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {pendingSubmissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--ui-border)] px-4 py-8 text-center text-base font-normal text-[var(--ui-muted)]">
            검토를 기다리는 일정 제보가 없습니다.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="reviewed-calendar-submissions">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="reviewed-calendar-submissions" className="text-[18px] font-bold text-[var(--ui-ink)]">
            최근 처리 내역
          </h3>
          <span className="text-[13px] font-medium text-[var(--ui-muted)]">{reviewedSubmissions.length}건</span>
        </div>
        {reviewedSubmissions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {reviewedSubmissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--ui-border)] px-4 py-8 text-center text-base font-normal text-[var(--ui-muted)]">
            아직 처리된 일정 제보가 없습니다.
          </p>
        )}
      </section>
    </div>
  );
}
