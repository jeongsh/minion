"use client";

import { Bell, Camera, Radio, Video } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";

import { updateFanNotificationSelectionAction } from "@/app/fan/[teamSlug]/actions";
import { ControlledDialog, dialogBodyClassName, DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
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
  const [selection, setSelection] = useState<FanNotificationSelection>(EMPTY_SELECTION);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  if (!open || typeof document === "undefined") return null;

  const save = () => {
    startTransition(async () => {
      const result = await updateFanNotificationSelectionAction(teamId, teamSlug, selection);
      if (!result.ok) {
        showToast({ title: result.error ?? "잠시 뒤 다시 시도해 주세요.", tone: "error" });
        return;
      }
      onSaved?.(selection);
      showToast({
        title: Object.values(selection).some(Boolean) ? "알림 설정 완료" : "알림 없이 팔로우",
        tone: "success",
      });
      onClose();
    });
  };

  return (
    <ControlledDialog open={open} onClose={onClose} dismissible={!pending} labelledBy={titleId} panelClassName="sm:max-w-[460px]" panelStyle={{ "--fan-notification-color": teamColor } as React.CSSProperties}>
      <DialogSheetHeader onClose={() => { if (!pending) onClose(); }} title={teamName + " 알림 설정"} titleId={titleId} />
      <div className={dialogBodyClassName}>
          {canConfigure ? (
            <>
              <p className="text-sm font-normal leading-5 text-[var(--ui-muted)]">받고 싶은 소식만 골라주세요. 선택하지 않아도 팔로우는 유지됩니다.</p>
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
              <p className="text-sm font-normal leading-5 text-[var(--ui-muted)]">로그인하면 경기, Instagram, 동영상 등 받고 싶은 팀 소식만 선택할 수 있어요.</p>
              <div className="mt-5 flex gap-2">
                <button type="button" className="min-h-11 flex-1 rounded-xl border border-[var(--ui-border)] px-4 text-[14px] font-medium text-[var(--ui-muted)]" onClick={onClose}>나중에</button>
                <Link className="flex min-h-11 flex-[1.4] items-center justify-center rounded-xl bg-[var(--fan-notification-color)] px-4 text-[14px] font-medium text-white" href={`/login?next=${encodeURIComponent(`/fan/${teamSlug}`)}`}>로그인하고 설정</Link>
              </div>
            </>
          )}
        </div>
    </ControlledDialog>
  );
}
