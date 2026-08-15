"use client";

import { Bell, Radio, Sparkles, Swords } from "lucide-react";
import { useState, useTransition } from "react";

import { updateNotificationPreferencesAction } from "@/app/me/settings/actions";
import { useToast } from "@/components/ui/toast";
import type { NotificationPreferences } from "@/lib/notifications";

type PreferenceKey = keyof NotificationPreferences;

const OPTIONS: Array<{
  key: Exclude<PreferenceKey, "inAppEnabled">;
  title: string;
  description: string;
  icon: typeof Bell;
}> = [
  { key: "matchStartEnabled", title: "경기 시작", description: "팔로우한 팀의 경기가 시작되면 알려드려요.", icon: Swords },
  { key: "matchEventsEnabled", title: "경기 주요 이벤트", description: "킬과 주요 오브젝트 등 실시간 경기 소식을 받아요.", icon: Radio },
  { key: "ratingOpenEnabled", title: "세트 평가 오픈", description: "경기 세트 평가가 열리면 알려드려요.", icon: Sparkles },
];

export function NotificationSettingsForm({ initialPreferences }: { initialPreferences: NotificationPreferences }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  const update = (key: PreferenceKey, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  return (
    <div>
      <SettingRow
        icon={Bell}
        title="인앱 알림"
        description="MINION을 이용하는 동안 알림함과 토스트로 소식을 받아요."
        checked={preferences.inAppEnabled}
        onChange={(checked) => update("inAppEnabled", checked)}
        emphasized
      />
      <div className={`mt-2 divide-y divide-[var(--ui-border)] transition-opacity ${preferences.inAppEnabled ? "opacity-100" : "pointer-events-none opacity-45"}`} aria-disabled={!preferences.inAppEnabled}>
        {OPTIONS.map((option) => (
          <SettingRow
            key={option.key}
            icon={option.icon}
            title={option.title}
            description={option.description}
            checked={preferences[option.key]}
            onChange={(checked) => update(option.key, checked)}
          />
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-[var(--ui-border)] pt-5">
        <p className="text-[13px] text-[var(--ui-muted)]">설정은 로그인한 모든 기기에 적용됩니다.</p>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const result = await updateNotificationPreferencesAction(preferences);
            showToast({
              title: result.ok ? "알림 설정 저장" : "저장 실패",
              description: result.ok ? "변경한 설정을 적용했어요." : result.error,
              tone: result.ok ? "success" : "error",
            });
          })}
          className="min-h-11 shrink-0 rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-foreground)] disabled:opacity-50"
        >
          {pending ? "저장 중..." : "변경사항 저장"}
        </button>
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, title, description, checked, onChange, emphasized = false }: {
  icon: typeof Bell;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  emphasized?: boolean;
}) {
  return (
    <label className={`flex min-h-[72px] cursor-pointer items-center gap-3 rounded-xl px-3 py-3 ${emphasized ? "bg-[var(--ui-surface-muted)]" : ""}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--ui-surface)] text-[var(--ui-muted)]"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[var(--ui-ink)]">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-5 text-[var(--ui-muted)]">{description}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--ui-border)] transition peer-checked:bg-[var(--accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}
