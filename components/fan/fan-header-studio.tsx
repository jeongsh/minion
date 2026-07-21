"use client";

import { Heart, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  deleteFanHeaderCandidate,
  submitFanHeaderCandidate,
  toggleFanHeaderVote,
} from "@/app/fan/[teamSlug]/header-actions";
import {
  FAN_HEADER_MIN_ASPECT,
  FAN_HEADER_MIN_WIDTH,
  fanHeaderUploadBlockedMessage,
  type FanHeaderState,
} from "@/lib/fan/fan-header";

function weekLabel(weekStart: string) {
  const [, month, day] = weekStart.split("-").map(Number);
  return `${month}월 ${day}일 주간`;
}

export function FanHeaderStudio({
  teamSlug,
  teamId,
  teamName,
  teamColor,
  isSignedIn,
  currentUserId,
  state,
}: {
  teamSlug: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  isSignedIn: boolean;
  currentUserId?: string;
  state: FanHeaderState;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/community/upload", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "업로드에 실패했어요.");
        return;
      }

      const result = await submitFanHeaderCandidate({
        teamId,
        teamSlug,
        imagePath: payload.path,
        width: payload.width,
        height: payload.height,
      });
      if (!result.ok) {
        setError(result.error ?? "등록에 실패했어요.");
        return;
      }
      router.refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleVote(candidateId: string) {
    if (!isSignedIn) {
      setError("로그인하면 투표할 수 있어요.");
      return;
    }
    startTransition(async () => {
      const result = await toggleFanHeaderVote(candidateId, teamSlug);
      if (!result.ok) setError(result.error ?? "투표에 실패했어요.");
      else router.refresh();
    });
  }

  function handleDelete(candidateId: string) {
    startTransition(async () => {
      const result = await deleteFanHeaderCandidate(candidateId, teamSlug);
      if (!result.ok) setError(result.error ?? "삭제에 실패했어요.");
      else router.refresh();
    });
  }

  const blockedMessage = state.uploadBlockedReason
    ? fanHeaderUploadBlockedMessage(state.uploadBlockedReason)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <p className="font-archivo text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-muted)]">
          This week
        </p>
        <h2 className="home-section-title">이번 주 {teamName} 헤더</h2>
        {state.activeImageUrl ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--ui-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.activeImageUrl} alt="" className="aspect-[16/5] w-full object-cover" />
          </div>
        ) : (
          <div className="grid aspect-[16/5] place-items-center rounded-2xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-6 text-center">
            <p className="text-[13px] font-semibold text-[var(--ui-muted)]">
              아직 이번 주 헤더가 정해지지 않았어요.
              <br />
              후보에 투표하면 다음 월요일에 1위가 헤더로 걸립니다.
            </p>
          </div>
        )}
        <p className="text-[12px] font-medium text-[var(--ui-muted)]">
          {weekLabel(state.weekStart)} · 매주 월요일 오전에 득표 1위가 자동으로 반영돼요.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="home-section-title">헤더 후보 {state.candidates.length}개</h2>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!state.canUpload || uploading}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: teamColor }}
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
              헤더 올리기
            </button>
            {blockedMessage ? (
              <span className="text-[12px] font-medium text-[var(--ui-muted)]">{blockedMessage}</span>
            ) : null}
          </div>
        </div>

        <p className="text-[12px] font-medium leading-[1.6] text-[var(--ui-muted)]">
          가로 {FAN_HEADER_MIN_WIDTH}px 이상, 가로:세로 {FAN_HEADER_MIN_ASPECT}:1 이상의 가로로 긴 이미지를 올려주세요.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-500">
            {error}
          </p>
        ) : null}

        {state.candidates.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-6 py-12 text-center">
            <p className="text-[13px] font-semibold text-[var(--ui-muted)]">
              아직 후보가 없어요. 첫 헤더를 올려보세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {state.candidates.map((candidate) => (
              <article
                key={candidate.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={candidate.imageUrl} alt="" className="aspect-[16/5] w-full object-cover" />
                <div className="flex min-w-0 items-center justify-between gap-3 px-3.5 py-3">
                  <span className="min-w-0 truncate text-[12px] font-semibold text-[var(--ui-muted)]">
                    {candidate.authorNickname ?? "익명 팬"}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {candidate.userId === currentUserId ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(candidate.id)}
                        disabled={pending}
                        aria-label="내 헤더 삭제"
                        className="grid h-8 w-8 place-items-center rounded-full border border-[var(--ui-border)] text-[var(--ui-muted)] transition hover:text-[var(--ui-ink)] disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleVote(candidate.id)}
                      disabled={pending}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-black transition disabled:opacity-50 ${
                        candidate.votedByMe
                          ? "border-transparent text-white"
                          : "border-[var(--ui-border)] text-[var(--ui-text)] hover:border-[var(--ui-muted)]"
                      }`}
                      style={candidate.votedByMe ? { background: teamColor } : undefined}
                    >
                      <Heart size={14} fill={candidate.votedByMe ? "currentColor" : "none"} />
                      {candidate.voteCount}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
