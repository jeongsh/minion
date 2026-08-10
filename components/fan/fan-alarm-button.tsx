"use client";

import { Bell } from "lucide-react";
import { useState, useTransition } from "react";

import { toggleFanNotificationAction } from "@/app/fan/[teamSlug]/actions";
import { FanHeaderTooltip, fanHeaderIconButtonClass } from "@/components/fan/fan-header-control-styles";
import { useToast } from "@/components/ui/toast";

export function FanAlarmButton({
  teamId,
  teamSlug,
  initialEnabled,
  teamColor,
  compact = false,
  iconOnly = false,
  inverted = false,
}: {
  teamId: string;
  teamSlug: string;
  initialEnabled: boolean;
  teamColor?: string;
  compact?: boolean;
  iconOnly?: boolean;
  inverted?: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
        aria-label={pending ? "알림 설정 중" : enabled ? "팬 채널 알림 끄기" : "팬 채널 알림 켜기"}
        aria-pressed={enabled}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await toggleFanNotificationAction(teamId, teamSlug, !enabled);
            if (result.ok) {
              setEnabled(result.enabled);
              showToast({
                title: result.enabled ? "알림 켬" : "알림 끔",
                description: result.enabled ? "새 소식이 오면 알려드릴게요." : "팬 채널에서 직접 확인할 수 있어요.",
                tone: "success",
              });
              return;
            }

            const message = result.error ?? "알림 설정에 실패했습니다.";
            setError(message);
            showToast({ title: "알림 설정 실패", description: message, tone: "error" });
          });
        }}
        className={iconOnly ? fanHeaderIconButtonClass : `inline-flex min-w-0 items-center justify-center gap-2 rounded-full border font-extrabold transition duration-200 focus-visible:outline-none focus-visible:ring-2 active:scale-[0.98] disabled:opacity-60 ${
          inverted
            ? "border-white/20 bg-white/10 text-white hover:bg-white/15 focus-visible:ring-white"
            : "border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink)] hover:bg-[var(--ui-surface-muted)] focus-visible:ring-[var(--ui-ink)]"
        } ${compact ? "h-10 px-3 text-[14px] sm:px-4" : "min-h-11 px-5 py-2.5 text-sm"}`}
        style={iconOnly && enabled && teamColor ? { color: teamColor } : undefined}
      >
        <Bell size={compact ? 15 : 16} fill={enabled ? "currentColor" : "none"} aria-hidden="true" />
        <span className={iconOnly ? "sr-only" : undefined}>{pending ? "저장 중..." : enabled ? "알림 켬" : "알림"}</span>
        {iconOnly ? <FanHeaderTooltip>{enabled ? "알림 끄기" : "알림 켜기"}</FanHeaderTooltip> : null}
      </button>
      {error ? <span className="mt-1 max-w-40 text-xs font-semibold text-red-600">{error}</span> : null}
    </div>
  );
}
