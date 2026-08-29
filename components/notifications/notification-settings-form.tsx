"use client";

import { Bell, Camera, ChevronDown, Gamepad2, MessageCircle, Radio, Swords, Video } from "lucide-react";
import { useState, useTransition } from "react";

import { updateNotificationPreferencesAction } from "@/app/me/settings/actions";
import { useToast } from "@/components/ui/toast";
import type { NotificationPreferences, TeamNotificationPreferences } from "@/lib/notifications";

type TeamPreferenceKey = Exclude<keyof TeamNotificationPreferences, "teamId" | "teamName" | "teamShortName">;

const TEAM_OPTIONS: Array<{
  key: TeamPreferenceKey;
  title: string;
  description: string;
  icon: typeof Bell;
}> = [
  { key: "matchAlertsEnabled", title: "경기", description: "경기 시작과 세트 평가를 알려드려요.", icon: Swords },
  { key: "liveMatchAlertsEnabled", title: "라이브 경기", description: "킬과 주요 오브젝트를 실시간으로 알려드려요.", icon: Radio },
  { key: "instagramAlertsEnabled", title: "Instagram", description: "팀과 소속 선수의 새 게시물을 알려드려요.", icon: Camera },
  { key: "videoAlertsEnabled", title: "동영상", description: "팀과 소속 선수의 새 영상을 알려드려요.", icon: Video },
  { key: "soloQueueAlertsEnabled", title: "솔랭", description: "소속 선수가 솔랭을 시작하면 알려드려요.", icon: Gamepad2 },
];

function enabledSummary(team: TeamNotificationPreferences) {
  const enabled = TEAM_OPTIONS.filter((option) => team[option.key]).map((option) => option.title);
  return enabled.length > 0 ? enabled.join(" · ") : "모든 알림 꺼짐";
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
    <div>
      <SettingRow
        icon={Bell}
        title="전체 알림"
        description="끄면 모든 알림을 잠시 받지 않아요. 세부 설정은 유지됩니다."
        checked={preferences.inAppEnabled}
        onChange={(checked) => setPreferences((current) => ({ ...current, inAppEnabled: checked }))}
        emphasized
      />

      <div className={`transition-opacity ${preferences.inAppEnabled ? "opacity-100" : "opacity-45"}`}>
        <div className="mt-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2">
          <SettingRow
            icon={MessageCircle}
            title="커뮤니티 알림"
            description="내 글의 새 댓글과 내 댓글의 새 답글을 알려드려요."
            checked={preferences.communityEnabled}
            onChange={(checked) => setPreferences((current) => ({ ...current, communityEnabled: checked }))}
          />
        </div>

        <div className="mt-3 space-y-2">
          {teams.length > 0 ? teams.map((team) => (
          <details key={team.teamId} className="group rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--ui-surface-muted)] text-[14px] font-medium text-[var(--ui-ink)]">
                {team.teamShortName.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-black leading-[22px] text-[var(--ui-ink)]">{team.teamName}</span>
                <span className="block truncate text-[13px] font-medium leading-[18px] text-[var(--ui-muted)]">{enabledSummary(team)}</span>
              </span>
              <ChevronDown size={17} className="shrink-0 text-[var(--ui-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="divide-y divide-[var(--ui-border)] border-t border-[var(--ui-border)] px-2">
              {TEAM_OPTIONS.map((option) => (
                <SettingRow
                  key={option.key}
                  icon={option.icon}
                  title={option.title}
                  description={option.description}
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
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-[var(--ui-border)] pt-4 sm:mt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-5">
        <p className="text-[13px] font-medium text-[var(--ui-muted)] sm:font-normal">설정은 로그인한 모든 기기에 적용됩니다.</p>
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

function SettingRow({ icon: Icon, title, description, checked, onChange, emphasized = false }: {
  icon: typeof Bell;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  emphasized?: boolean;
}) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center gap-2 rounded-xl px-2 py-2 sm:min-h-[68px] sm:gap-3 sm:px-3 ${emphasized ? "bg-[var(--ui-surface-muted)]" : ""}`}>
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-[var(--ui-surface)] text-[var(--ui-muted)] sm:h-9 sm:w-9"><Icon size={16} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-[var(--ui-ink)]">{title}</span>
        <span className="mt-0.5 block text-[13px] font-medium leading-5 text-[var(--ui-muted)] sm:font-normal">{description}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--ui-border)] transition peer-checked:bg-[var(--accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}
