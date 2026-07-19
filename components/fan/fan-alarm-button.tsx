"use client";

import { Bell } from "lucide-react";
import { useState, useTransition } from "react";

import { toggleFanNotificationAction } from "@/app/fan/[teamSlug]/actions";

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
              return;
            }
            setError(result.error ?? "알림 설정에 실패했습니다.");
          });
        }}
        className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] font-extrabold text-[var(--ui-ink)] shadow-sm transition hover:bg-[var(--ui-surface-muted)] active:scale-[0.97] disabled:opacity-60 ${
          compact ? "h-9 px-3 text-[14px] sm:h-10 sm:px-4" : "min-h-11 px-5 py-2.5 text-sm"
        }`}
      >
        <Bell size={compact ? 15 : 16} aria-hidden="true" />
        <span>{pending ? "저장..." : enabled ? "알림 켬" : "알림"}</span>
      </button>
      {error ? <span className="mt-1 max-w-40 text-xs font-semibold text-red-600">{error}</span> : null}
    </div>
  );
}
