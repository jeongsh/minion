"use client";

import { Bell, Camera, Radio, Video, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { updateFanNotificationSelectionAction } from "@/app/fan/[teamSlug]/actions";
import { DialogSheetHandle } from "@/components/responsive/adaptive-dialog";
import { useToast } from "@/components/ui/toast";
import type { FanNotificationSelection } from "@/lib/notifications";

const EMPTY_SELECTION: FanNotificationSelection = {
  matchAlertsEnabled: false,
  liveMatchAlertsEnabled: false,
  instagramAlertsEnabled: false,
  videoAlertsEnabled: false,
};

const OPTIONS = [
  { key: "matchAlertsEnabled", title: "경기", description: "응원팀 경기 시작과 세트 평가", icon: Bell },
  { key: "liveMatchAlertsEnabled", title: "라이브 경기", description: "킬과 주요 오브젝트 실시간 소식", icon: Radio },
  { key: "instagramAlertsEnabled", title: "Instagram", description: "팀과 선수의 새 게시물", icon: Camera },
  { key: "videoAlertsEnabled", title: "동영상", description: "팀과 선수의 새 YouTube 영상", icon: Video },
] as const;

export function FanNotificationPreferenceDialog({
  canConfigure,
  onClose,
  onSaved,
  open,
  teamColor,
  teamId,
  teamName,
  teamSlug,
}: {
  canConfigure: boolean;
  onClose: () => void;
  onSaved?: (selection: FanNotificationSelection) => void;
  open: boolean;
  teamColor: string;
  teamId: string;
  teamName: string;
  teamSlug: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<FanNotificationSelection>(EMPTY_SELECTION);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("button, a")?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const save = () => {
    startTransition(async () => {
      const result = await updateFanNotificationSelectionAction(teamId, teamSlug, selection);
      if (!result.ok) {
        showToast({ title: "알림 설정 실패", description: result.error ?? "잠시 뒤 다시 시도해 주세요.", tone: "error" });
        return;
      }
      onSaved?.(selection);
      showToast({
        title: Object.values(selection).some(Boolean) ? "알림 설정 완료" : "알림 없이 팔로우",
        description: Object.values(selection).some(Boolean) ? "선택한 팀 소식만 알려드릴게요." : "알림은 나중에 내 정보에서 켤 수 있어요.",
        tone: "success",
      });
      onClose();
    });
  };

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-[1100] flex items-end justify-center bg-black/55 sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => { if (event.currentTarget === event.target && !pending) onClose(); }}
    >
      <section
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-[var(--ui-surface)] shadow-2xl sm:max-w-[460px] sm:rounded-[24px]"
        role="dialog"
        style={{ "--fan-notification-color": teamColor } as React.CSSProperties}
      >
        <DialogSheetHandle />
        <header className="flex min-h-12 items-center gap-2 px-4 sm:px-5">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-[18px] font-extrabold leading-7 text-[var(--ui-ink)]">{teamName} 알림 설정</h2>
          <button type="button" aria-label="알림 설정 닫기" className="grid h-11 w-11 place-items-center rounded-xl text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]" disabled={pending} onClick={onClose}><X size={19} /></button>
        </header>

        <div className="min-h-0 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-1 sm:px-5 sm:pb-5">
          {canConfigure ? (
            <>
              <p className="text-base font-normal leading-6 text-[var(--ui-muted)]">받고 싶은 소식만 골라주세요. 선택하지 않아도 팔로우는 유지됩니다.</p>
              <div className="mt-4 space-y-2" aria-label={`${teamName} 알림 종류`}>
                {OPTIONS.map(({ key, title, description, icon: Icon }) => {
                  const checked = selection[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={checked}
                      className={`flex min-h-[68px] w-full items-center gap-3 rounded-xl border px-3 text-left transition ${checked ? "border-[var(--fan-notification-color)] bg-[color-mix(in_srgb,var(--fan-notification-color)_8%,var(--ui-surface))]" : "border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-card-hover)]"}`}
                      onClick={() => setSelection((current) => ({ ...current, [key]: !current[key] }))}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ui-surface-muted)]" style={{ color: checked ? teamColor : "var(--ui-muted)" }}><Icon size={19} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold leading-[22px] text-[var(--ui-ink)]">{title}</span>
                        <span className="block text-[13px] font-normal leading-[18px] text-[var(--ui-muted)]">{description}</span>
                      </span>
                      <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[var(--fan-notification-color)]" : "bg-[var(--ui-border)]"}`}><span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : ""}`} /></span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex gap-2">
                <button type="button" className="min-h-11 flex-1 rounded-xl border border-[var(--ui-border)] px-4 text-[14px] font-medium text-[var(--ui-muted)]" disabled={pending} onClick={onClose}>나중에</button>
                <button type="button" className="min-h-11 flex-[1.4] rounded-xl bg-[var(--fan-notification-color)] px-4 text-[14px] font-medium text-white disabled:opacity-50" disabled={pending} onClick={save}>{pending ? "저장 중…" : Object.values(selection).some(Boolean) ? "선택 완료" : "알림 없이 팔로우"}</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-base font-normal leading-6 text-[var(--ui-muted)]">로그인하면 경기, Instagram, 동영상 등 받고 싶은 팀 소식만 선택할 수 있어요.</p>
              <div className="mt-5 flex gap-2">
                <button type="button" className="min-h-11 flex-1 rounded-xl border border-[var(--ui-border)] px-4 text-[14px] font-medium text-[var(--ui-muted)]" onClick={onClose}>나중에</button>
                <Link className="flex min-h-11 flex-[1.4] items-center justify-center rounded-xl bg-[var(--fan-notification-color)] px-4 text-[14px] font-medium text-white" href={`/login?next=${encodeURIComponent(`/fan/${teamSlug}`)}`}>로그인하고 설정</Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
