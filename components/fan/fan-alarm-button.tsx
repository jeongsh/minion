"use client";

import { Bell } from "lucide-react";
import { useState, useTransition } from "react";

import { toggleFanNotificationAction } from "@/app/fan/[teamSlug]/actions";
import { useToast } from "@/components/ui/toast";

export function FanAlarmButton({
  teamId,
  teamSlug,
  initialEnabled,
  compact = false,
}: {
  teamId: string;
  teamSlug: string;
  initialEnabled: boolean;
  compact?: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
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
        className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] font-extrabold text-[var(--ui-ink)] shadow-sm transition hover:bg-[var(--ui-surface-muted)] active:scale-[0.97] disabled:opacity-60 ${
          compact ? "h-9 px-3 text-[14px] sm:h-10 sm:px-4" : "min-h-11 px-5 py-2.5 text-sm"
        }`}
      >
        <Bell size={compact ? 15 : 16} fill={enabled ? "currentColor" : "none"} aria-hidden="true" />
        <span>{pending ? "저장 중..." : enabled ? "알림 켬" : "알림"}</span>
      </button>
      {error ? <span className="mt-1 max-w-40 text-xs font-semibold text-red-600">{error}</span> : null}
    </div>
  );
}
