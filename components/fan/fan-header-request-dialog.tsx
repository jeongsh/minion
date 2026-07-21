"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { submitFanHeaderCandidate } from "@/app/fan/[teamSlug]/header-actions";
import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import {
  FAN_HEADER_MIN_ASPECT,
  FAN_HEADER_MIN_WIDTH,
  type FanHeaderUploadBlockedReason,
  fanHeaderUploadBlockedMessage,
} from "@/lib/fan/fan-header-constants";

const CAPTION_MAX_LENGTH = 60;

type Picked = { url: string; path: string; width: number; height: number };

/**
 * 업로드한 이미지가 실제 헤더에서 어떻게 잘리는지 보여준다.
 * 실제 헤더(fan-channel-header.tsx)와 같은 검정 스크림을 얹어야 글자 가독성까지 판단할 수 있다.
 */
function PreviewFrame({
  label,
  src,
  aspect,
  objectPosition,
  children,
}: {
  label: string;
  src: string;
  aspect: string;
  objectPosition: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--ui-muted)]">{label}</span>
      <div className={`relative w-full overflow-hidden rounded-xl border border-[var(--ui-border)] ${aspect}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition }} />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 from-10% to-transparent to-65%" />
        <div className="absolute inset-0 flex flex-col justify-center gap-1 px-3">{children}</div>
      </div>
    </div>
  );
}

export function FanHeaderRequestDialog({
  teamId,
  teamSlug,
  teamName,
  teamColor,
  triggerClassName,
  trigger,
  blockedReason,
}: {
  teamId: string;
  teamSlug: string;
  teamName: string;
  teamColor: string;
  triggerClassName: string;
  trigger: React.ReactNode;
  /** 서버에서 판정한 요청 자격. null이면 요청 가능. */
  blockedReason: FanHeaderUploadBlockedReason | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const blockedMessage = blockedReason ? fanHeaderUploadBlockedMessage(blockedReason) : null;

  // 막지는 않고 알려만 준다. 요청자가 프리뷰를 보고 직접 판단한다.
  const warnings = picked
    ? [
        picked.width < FAN_HEADER_MIN_WIDTH
          ? `가로 ${picked.width}px — ${FAN_HEADER_MIN_WIDTH}px보다 작아 흐릿하게 보일 수 있어요.`
          : null,
        picked.width / picked.height < FAN_HEADER_MIN_ASPECT
          ? "세로로 긴 이미지라 위아래가 많이 잘려요."
          : null,
      ].filter((value): value is string => Boolean(value))
    : [];

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
      setPicked({ url: payload.url, path: payload.path, width: payload.width, height: payload.height });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSubmit() {
    if (!picked) return;
    startTransition(async () => {
      const result = await submitFanHeaderCandidate({
        teamId,
        teamSlug,
        imagePath: picked.path,
        width: picked.width,
        height: picked.height,
        caption,
      });
      if (!result.ok) {
        setError(result.error ?? "요청에 실패했어요.");
        return;
      }
      setDone(true);
      setPicked(null);
      setCaption("");
      router.refresh();
    });
  }

  return (
    <AdaptiveDialog title={`${teamName} 대문 변경 요청`} trigger={trigger} triggerClassName={triggerClassName}>
      <div className="flex flex-col gap-4">
        {blockedMessage ? (
          <p className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3.5 py-3 text-[13px] font-semibold text-[var(--ui-text)]">
            {blockedMessage}
          </p>
        ) : (
          <>
            <p className="text-[13px] font-medium leading-[1.6] text-[var(--ui-muted)]">
              올린 이미지는 바로 반영되지 않아요. 운영진이 확인한 뒤 투표 공지로 올라갑니다.
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

            {picked ? (
              <>
                <div className="flex flex-col gap-3">
                  <PreviewFrame label="데스크탑" src={picked.url} aspect="aspect-[24/5]" objectPosition="center 35%">
                    <span className="text-[18px] font-black leading-none" style={{ color: teamColor }}>
                      {teamName}
                    </span>
                    <span className="text-[10px] font-bold text-white/85">7월 30일 (목) 19:00 · LoL PARK</span>
                  </PreviewFrame>
                  <PreviewFrame label="모바일" src={picked.url} aspect="aspect-[9/4]" objectPosition="center 30%">
                    <span className="text-[15px] font-black leading-none" style={{ color: teamColor }}>
                      {teamName}
                    </span>
                    <span className="text-[10px] font-bold text-white">팔로워 · 팬 채널입니다</span>
                  </PreviewFrame>
                </div>

                {warnings.length ? (
                  <ul className="flex flex-col gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5">
                    {warnings.map((warning) => (
                      <li key={warning} className="text-[12px] font-semibold text-amber-600 dark:text-amber-400">
                        {warning}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold text-[var(--ui-text)]">한 줄 설명 (선택)</span>
                  <input
                    value={caption}
                    onChange={(event) => setCaption(event.target.value.slice(0, CAPTION_MAX_LENGTH))}
                    placeholder="어떤 장면인지 짧게 적어주세요"
                    className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 text-[13px] font-medium text-[var(--ui-ink)] outline-none focus:border-[var(--ui-muted)]"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={pending}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-black text-white transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: teamColor }}
                  >
                    {pending ? <Loader2 size={15} className="animate-spin" /> : null}
                    이 이미지로 요청하기
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || pending}
                    className="rounded-full border border-[var(--ui-border)] px-4 py-2.5 text-[13px] font-black text-[var(--ui-text)] transition hover:text-[var(--ui-ink)] disabled:opacity-50"
                  >
                    다시 고르기
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-6 py-10 transition hover:border-[var(--ui-muted)] disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 size={20} className="animate-spin text-[var(--ui-muted)]" />
                ) : (
                  <ImagePlus size={20} className="text-[var(--ui-muted)]" />
                )}
                <span className="text-[13px] font-black text-[var(--ui-text)]">
                  {uploading ? "올리는 중…" : "이미지 고르기"}
                </span>
                <span className="text-[12px] font-medium text-[var(--ui-muted)]">
                  가로로 긴 이미지가 잘 어울려요
                </span>
              </button>
            )}

            {done ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                요청이 접수됐어요. 운영진 확인 후 투표 공지로 올라갑니다.
              </p>
            ) : null}
          </>
        )}

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] font-semibold text-red-500">
            {error}
          </p>
        ) : null}
      </div>
    </AdaptiveDialog>
  );
}
