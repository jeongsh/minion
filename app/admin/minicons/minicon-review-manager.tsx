"use client";

import { CheckCircle2, ChevronDown, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";

import { reviewMiniconPackAction } from "./actions";
import type { AdminMiniconPack, AdminMiniconPackStatus } from "./types";

const REVIEW_NOTE_MAX_LENGTH = 500;

const STATUS_META: Record<AdminMiniconPackStatus, { label: string; className: string }> = {
  draft: {
    label: "작성 중",
    className: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  pending_review: {
    label: "심사 대기",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  published: {
    label: "공개 중",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    label: "반려됨",
    className: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300",
  },
  retired: {
    label: "공개 종료",
    className: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  suspended: {
    label: "이용 중지",
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

function MiniconItems({ pack, initiallyOpen }: { pack: AdminMiniconPack; initiallyOpen: boolean }) {
  return (
    <details open={initiallyOpen} className="group rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-[14px] font-medium text-[var(--ui-text)] marker:content-none">
        <span>전체 미니콘 확인 · {pack.itemCount}개</span>
        <ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid max-h-[28rem] grid-cols-4 gap-2 overflow-y-auto border-t border-[var(--ui-border)] p-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {pack.items.map((item) => (
          <div key={item.id} className="min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={`${pack.name} ${item.name}`}
              loading="lazy"
              className="aspect-square w-full rounded-lg bg-[var(--ui-surface)] object-cover"
            />
            <p className="mt-1 truncate text-center text-[13px] font-normal text-[var(--ui-muted)]">{item.name}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function ReviewMetadata({ pack }: { pack: AdminMiniconPack }) {
  if (!pack.reviewedAt) {
    return (
      <p className="text-[13px] font-normal leading-5 text-[var(--ui-muted)]">
        {pack.isOfficial ? "관리자 직접 등록 · 심사 기록 없음" : "아직 심사 기록이 없습니다."}
      </p>
    );
  }

  return (
    <div className="text-[13px] font-normal leading-5 text-[var(--ui-muted)]">
      <p>심사자 {pack.reviewerName ?? "관리자"} · {formatKST(pack.reviewedAt)}</p>
      {pack.reviewNote ? <p className="mt-1 whitespace-pre-wrap break-words">심사 메모 · {pack.reviewNote}</p> : null}
    </div>
  );
}

function MiniconPackCard({ pack }: { pack: AdminMiniconPack }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [reviewNote, setReviewNote] = useState(pack.reviewNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const status = STATUS_META[pack.status];

  function review(nextStatus: "published" | "rejected") {
    setError(null);
    startTransition(async () => {
      const result = await reviewMiniconPackAction({
        packId: pack.id,
        status: nextStatus,
        reviewNote,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      showToast({
        title: nextStatus === "published" ? "미니콘 승인 완료" : "미니콘 반려 완료",
        description: result.message,
        tone: nextStatus === "published" ? "success" : "info",
      });
      router.refresh();
    });
  }

  return (
    <article className="rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pack.coverUrl}
            alt={`${pack.name} 대표 미니콘`}
            className="h-20 w-20 shrink-0 rounded-2xl bg-[var(--ui-surface-muted)] object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="min-w-0 break-words text-[16px] font-bold text-[var(--ui-ink)]">{pack.name}</h4>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[13px] font-medium ${status.className}`}>
                {status.label}
              </span>
              {pack.isOfficial ? (
                <span className="shrink-0 rounded-full bg-[var(--palette-green-butter-main)] px-2.5 py-1 text-[13px] font-medium text-[#071a11]">
                  공식
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[13px] font-normal leading-5 text-[var(--ui-muted)]">
              등록자 {pack.creatorName} · {formatKST(pack.createdAt)} · {pack.itemCount}개
            </p>
            {pack.description ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-[16px] font-normal leading-6 text-[var(--ui-text)]">
                {pack.description}
              </p>
            ) : (
              <p className="mt-2 text-[16px] font-normal text-[var(--ui-muted)]">설명 없음</p>
            )}
          </div>
        </div>

        <MiniconItems pack={pack} initiallyOpen={pack.status === "pending_review"} />

        {pack.status === "pending_review" ? (
          <div className="flex flex-col gap-3 border-t border-[var(--ui-border)] pt-4">
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-medium text-[var(--ui-text)]">심사 의견 (신청자에게 공개 · 반려 시 필수)</span>
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                maxLength={REVIEW_NOTE_MAX_LENGTH}
                rows={3}
                placeholder="승인 안내 또는 반려 사유를 남겨 주세요."
                className="resize-y rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5 text-[16px] font-normal leading-6 text-[var(--ui-ink)] outline-none transition-colors placeholder:text-[var(--ui-muted)] focus:border-[var(--ui-muted)]"
              />
              <span className="text-right text-[13px] font-normal text-[var(--ui-muted)]">
                {reviewNote.length}/{REVIEW_NOTE_MAX_LENGTH}자
              </span>
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={pending}
                onClick={() => review("published")}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50"
              >
                {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                승인하고 공개
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => review("rejected")}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/35 bg-red-500/8 px-4 text-[14px] font-medium text-red-600 transition-colors hover:bg-red-500/15 disabled:cursor-wait disabled:opacity-50 dark:text-red-300"
              >
                <XCircle size={16} aria-hidden="true" />
                반려
              </button>
            </div>

            {error ? (
              <p role="alert" className="text-[13px] font-medium leading-5 text-red-500">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <ReviewMetadata pack={pack} />
        )}
      </div>
    </article>
  );
}

export function MiniconReviewManager({ packs }: { packs: AdminMiniconPack[] }) {
  const pendingPacks = packs.filter((pack) => pack.status === "pending_review");
  const reviewedPacks = packs.filter((pack) => pack.status !== "pending_review");

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3" aria-labelledby="pending-minicon-packs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="pending-minicon-packs" className="text-[18px] font-bold text-[var(--ui-ink)]">심사 대기</h3>
          <span className="text-[13px] font-normal text-[var(--ui-muted)]">{pendingPacks.length}건</span>
        </div>
        {pendingPacks.length > 0 ? (
          <div className="grid gap-3">
            {pendingPacks.map((pack) => <MiniconPackCard key={pack.id} pack={pack} />)}
          </div>
        ) : (
          <p className="rounded-[var(--ui-card-radius)] border border-dashed border-[var(--ui-border)] px-4 py-8 text-center text-[16px] font-normal text-[var(--ui-muted)]">
            심사를 기다리는 미니콘 신청이 없습니다.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="reviewed-minicon-packs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="reviewed-minicon-packs" className="text-[18px] font-bold text-[var(--ui-ink)]">최근 처리 및 등록 내역</h3>
          <span className="text-[13px] font-normal text-[var(--ui-muted)]">{reviewedPacks.length}건</span>
        </div>
        {reviewedPacks.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {reviewedPacks.map((pack) => <MiniconPackCard key={pack.id} pack={pack} />)}
          </div>
        ) : (
          <p className="rounded-[var(--ui-card-radius)] border border-dashed border-[var(--ui-border)] px-4 py-8 text-center text-[16px] font-normal text-[var(--ui-muted)]">
            아직 처리되거나 등록된 미니콘 패키지가 없습니다.
          </p>
        )}
      </section>
    </div>
  );
}
