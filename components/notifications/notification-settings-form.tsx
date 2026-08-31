"use client";

import { Bell, Camera, ChevronDown, Gamepad2, MessageCircle, Radio, Swords, Video } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";

import { updateNotificationPreferencesAction } from "@/app/me/settings/actions";
import { useToast } from "@/components/ui/toast";
import type { NotificationPreferences, TeamNotificationPreferences } from "@/lib/notifications";

type TeamPreferenceKey = Exclude<keyof TeamNotificationPreferences, "teamId" | "teamName" | "teamShortName" | "teamLogoUrl">;

const TEAM_OPTIONS: Array<{
  key: TeamPreferenceKey;
  title: string;
  icon: typeof Bell;
}> = [
  { key: "matchAlertsEnabled", title: "경기", icon: Swords },
  { key: "liveMatchAlertsEnabled", title: "라이브 경기", icon: Radio },
  { key: "instagramAlertsEnabled", title: "Instagram", icon: Camera },
  { key: "videoAlertsEnabled", title: "동영상", icon: Video },
  { key: "soloQueueAlertsEnabled", title: "솔랭", icon: Gamepad2 },
];

function enabledCount(team: TeamNotificationPreferences) {
  return TEAM_OPTIONS.filter((option) => team[option.key]).length;
}

export function NotificationSettingsForm({ initialPreferences, initialTeams }: {
  initialPreferences: NotificationPreferences;
  initialTeams: TeamNotificationPreferences[];
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [teams, setTeams] = useState(initialTeams);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  const updateTeam = (teamId: string, key: TeamPreferenceKey, value: boolean) => {
    setTeams((current) => current.map((team) => team.teamId === teamId ? { ...team, [key]: value } : team));
  };

  return (
    <div className="space-y-5">
      <section aria-labelledby="common-notification-heading">
        <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
          <h4 id="common-notification-heading" className="text-[15px] font-bold text-[var(--ui-ink)]">공통 알림</h4>
          {!preferences.inAppEnabled ? <span className="rounded-full bg-[#766a58]/12 px-2.5 py-1 text-[13px] font-medium text-[#766a58] dark:bg-[#aa9c86]/12 dark:text-[#aa9c86]">일시 중지</span> : null}
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
          <SettingRow
            icon={Bell}
            title="전체 알림"
            checked={preferences.inAppEnabled}
            onChange={(checked) => setPreferences((current) => ({ ...current, inAppEnabled: checked }))}
            emphasized
          />
          <div className={`mx-3 border-t border-[var(--ui-border)] transition-opacity ${preferences.inAppEnabled ? "opacity-100" : "opacity-45"}`} />
          <SettingRow
            icon={MessageCircle}
            title="커뮤니티 알림"
            checked={preferences.communityEnabled}
            onChange={(checked) => setPreferences((current) => ({ ...current, communityEnabled: checked }))}
            muted={!preferences.inAppEnabled}
          />
        </div>
      </section>

      <section aria-labelledby="team-notification-heading">
        <div className="mb-2.5 px-1">
          <h4 id="team-notification-heading" className="text-[15px] font-bold text-[var(--ui-ink)]">팀별 알림</h4>
        </div>
        <div className={`space-y-2.5 transition-opacity ${preferences.inAppEnabled ? "opacity-100" : "opacity-45"}`}>
          {teams.length > 0 ? teams.map((team) => (
          <details key={team.teamId} className="group overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] open:shadow-sm">
            <summary className="flex min-h-[68px] cursor-pointer list-none items-center gap-3 px-3 py-2.5 transition hover:bg-[var(--ui-card-hover)] [&::-webkit-details-marker]:hidden">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white p-1.5 shadow-sm">
                {team.teamLogoUrl ? (
                  <Image src={team.teamLogoUrl} alt={`${team.teamName} 로고`} width={36} height={36} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[14px] font-medium text-slate-700">{team.teamShortName.slice(0, 2)}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold leading-6 text-[var(--ui-ink)]">{team.teamName}</span>
                <span className="mt-0.5 block text-[13px] font-normal leading-[18px] text-[var(--ui-muted)]">알림 {enabledCount(team)}개 켜짐</span>
              </span>
              <span className="mr-1 flex items-center gap-2">
                <span className="hidden rounded-full bg-[var(--ui-surface-muted)] px-2.5 py-1 text-[13px] font-medium text-[var(--ui-muted)] sm:inline">{enabledCount(team)}/{TEAM_OPTIONS.length}</span>
                <ChevronDown size={18} className="shrink-0 text-[var(--ui-muted)] transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="divide-y divide-[var(--ui-border)] border-t border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-surface-muted)_36%,var(--ui-surface))] px-3">
              {TEAM_OPTIONS.map((option) => (
                <SettingRow
                  key={option.key}
                  icon={option.icon}
                  title={option.title}
                  checked={team[option.key]}
                  onChange={(checked) => updateTeam(team.teamId, option.key, checked)}
                />
              ))}
            </div>
          </details>
          )) : (
            <div className="rounded-xl border border-dashed border-[var(--ui-border)] px-4 py-6 text-center">
              <p className="text-base font-medium text-[var(--ui-muted)]">팔로우한 팀이 없습니다.</p>
            </div>
          )}
        </div>
      </section>

      <div className="flex border-t border-[var(--ui-border)] pt-4 sm:justify-end sm:pt-5">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const result = await updateNotificationPreferencesAction(preferences, teams);
            showToast({
              title: result.ok ? "알림 설정 저장" : "저장 실패",
              description: result.ok ? "변경한 설정을 적용했어요." : result.error,
              tone: result.ok ? "success" : "error",
            });
          })}
          className="min-h-9 w-full shrink-0 rounded-lg bg-[var(--accent)] px-5 text-[13px] font-medium text-[var(--accent-foreground)] disabled:opacity-50 sm:min-h-11 sm:w-auto sm:text-sm"
        >
          {pending ? "저장 중..." : "변경사항 저장"}
        </button>
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, title, checked, onChange, emphasized = false, muted = false }: {
  icon: typeof Bell;
  title: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  emphasized?: boolean;
  muted?: boolean;
}) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2 transition hover:bg-[var(--ui-card-hover)] ${emphasized ? "bg-[var(--ui-surface-muted)]" : ""} ${muted ? "opacity-45" : ""}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--accent)_13%,transparent)] text-[var(--accent)]"><Icon size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-[22px] text-[var(--ui-ink)]">{title}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--ui-border)] transition peer-checked:bg-[var(--accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}
