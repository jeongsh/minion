"use client";

import { Camera, Check, LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { completeOnboardingAction, saveOnboardingProfileAction } from "@/app/onboarding/actions";
import { RankAvatar } from "@/components/rank/rank-avatar";
import { DialogSheetHandle } from "@/components/responsive/adaptive-dialog";
import { TeamLogo } from "@/components/ui/team-logo";
import { INITIAL_PROFILE_STATE } from "@/lib/auth/action-state";
import { getGuestNicknameAction } from "@/lib/community/actions";
import type { Team } from "@/lib/types";

type OnboardingTeam = Pick<
  Team,
  "id" | "slug" | "name" | "shortName" | "logoUrl" | "logoWhiteUrl" | "useWhiteLogoOnDark" | "fanSiteHost"
>;

export function OnboardingDialog({
  initialNickname,
  initialProfileImageUrl,
  next,
  teams,
}: {
  initialNickname: string;
  initialProfileImageUrl: string | null;
  next: string;
  teams: OnboardingTeam[];
}) {
  const router = useRouter();
  const [profileState, profileAction, profilePending] = useActionState(
    saveOnboardingProfileAction,
    INITIAL_PROFILE_STATE,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialProfileImageUrl);
  const [nickname, setNickname] = useState(initialNickname);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [finishing, startFinishing] = useTransition();
  const step = profileState.status === "success" ? 2 : 1;

  const initials = useMemo(() => nickname.trim().slice(0, 2).toUpperCase() || "MY", [nickname]);

  useEffect(() => {
    if (initialNickname.trim()) return;

    let active = true;
    void getGuestNicknameAction().then((result) => {
      if (!active || !result.ok) return;
      setNickname((current) => current.trim() || result.nickname);
    });

    return () => {
      active = false;
    };
  }, [initialNickname]);

  function finish(team?: OnboardingTeam) {
    if (finishing) return;
    setPendingTeamId(team?.id ?? "skip");
    setTeamError(null);
    startFinishing(async () => {
      const result = await completeOnboardingAction(
        team ? { teamId: team.id, teamSlug: team.fanSiteHost || team.slug } : {},
      );
      if (!result.ok) {
        setPendingTeamId(null);
        setTeamError(result.error ?? "온보딩을 완료하지 못했습니다. 잠시 뒤 다시 시도해주세요.");
        return;
      }
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 flex items-end justify-center overflow-hidden bg-black/70 backdrop-blur-[3px] sm:items-center sm:overflow-y-auto sm:px-4 sm:py-6"
      style={{ zIndex: 9999 }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-b-0 border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[0_24px_80px_rgba(0,0,0,0.42)] transition-[max-width] sm:my-auto sm:rounded-2xl sm:border-b ${step === 1 ? "sm:max-w-[480px]" : "sm:max-w-[680px]"}`}
      >
        <DialogSheetHandle />
        <div className="px-4 pb-3 pt-1 sm:px-6 sm:pt-4">
          <div className="flex items-center justify-between gap-4 text-[13px] font-medium text-[var(--ui-muted)]">
            <span>{step === 1 ? "프로필 설정" : "최애팀 선택"}</span>
            <span>{step} / 2</span>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2" aria-label={`온보딩 ${step}/2단계`}>
            <span className="h-1 rounded-full bg-[var(--accent)]" />
            <span className={`h-1 rounded-full ${step === 2 ? "bg-[var(--accent)]" : "bg-[var(--ui-border)]"}`} />
          </div>
        </div>

        {step === 1 ? (
          <form action={profileAction} className="min-h-0 overflow-y-auto px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
            <h1 id="onboarding-title" className="font-paperozi text-center text-[20px] leading-7 text-[var(--ui-ink)] sm:text-[24px] sm:leading-[1.35]">
              MINION에서 사용할 이름
            </h1>

            <label className="group relative mx-auto mt-4 block w-fit cursor-pointer sm:mt-6" aria-label="프로필 사진 선택">
              <span className="block sm:hidden">
                <RankAvatar tier="bronze" src={previewUrl} alt="선택한 프로필 이미지" fallback={initials} size="mobile" />
              </span>
              <span className="hidden sm:block">
                <RankAvatar tier="bronze" src={previewUrl} alt="선택한 프로필 이미지" fallback={initials} size="profile" />
              </span>
              <span
                className="absolute grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--ui-surface)] bg-[var(--ui-ink)] text-[var(--ui-surface)] shadow-md transition group-hover:scale-105 sm:h-8 sm:w-8 sm:border-[3px]"
                style={{ right: -4, top: -4 }}
              >
                <Camera size={15} />
              </span>
              <input
                type="file"
                name="profileImage"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setPreviewUrl(URL.createObjectURL(file));
                }}
              />
            </label>

            <div className="mt-5 flex flex-col gap-2 sm:mt-6">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="onboarding-nickname" className="text-sm font-medium text-[var(--ui-ink)]">닉네임</label>
                <span className="text-[13px] font-normal tabular-nums text-[var(--ui-muted)]">{nickname.length} / 16</span>
              </div>
              <input
                id="onboarding-nickname"
                name="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                minLength={2}
                maxLength={16}
                required
                placeholder="닉네임을 입력해주세요"
                className="min-h-11 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3.5 text-base text-[var(--ui-ink)] outline-none transition placeholder:text-[var(--ui-muted)] focus:border-[var(--accent)] focus:bg-[var(--ui-surface)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)] sm:min-h-12 sm:px-4"
              />
              <p className="text-[13px] font-normal text-[var(--ui-muted)]">2~16자 · 중복 닉네임은 사용할 수 없어요.</p>
            </div>

            {profileState.status === "error" ? <p role="alert" className="mt-4 text-sm text-red-600">{profileState.message}</p> : null}

            <button type="submit" disabled={profilePending || nickname.trim().length < 2} className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-foreground)] shadow-[0_8px_24px_color-mix(in_srgb,var(--accent)_22%,transparent)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 sm:mt-5 sm:min-h-12">
              {profilePending ? <><LoaderCircle size={17} className="mr-2 animate-spin" />저장 중…</> : "계속하기"}
            </button>
          </form>
        ) : (
          <div className="min-h-0 overflow-y-auto px-4 pb-5 pt-4 sm:px-6 sm:py-5">
            <div className="text-center">
              <h1 id="onboarding-title" className="font-paperozi text-[20px] leading-7 text-[var(--ui-ink)] sm:text-[24px] sm:leading-[1.35]">응원할 팀을 골라주세요</h1>
              <p className="mx-auto mt-2 max-w-[600px] text-base font-normal leading-6 text-[var(--ui-muted)] text-balance">최애팀 소식과 팬페이지를 더 빠르게 만날 수 있어요. 아직 없다면 건너뛰어도 괜찮아요.</p>
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="최애팀 선택">
              {teams.map((team) => {
                const pending = pendingTeamId === team.id;
                const selected = selectedTeamId === team.id;
                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      disabled={finishing}
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`group relative flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border px-2 py-1.5 transition disabled:opacity-55 sm:min-h-24 sm:gap-1.5 sm:py-2 ${selected ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_9%,var(--ui-surface))] ring-2 ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]" : "border-[var(--ui-border)] bg-[var(--ui-surface)] hover:border-[var(--accent)] hover:bg-[var(--ui-card-hover)]"}`}
                      aria-label={`${team.name}을 최애팀으로 선택`}
                      aria-pressed={selected}
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-white p-1 sm:h-12 sm:w-12 sm:p-1.5"><TeamLogo team={team} size="h-8 w-8 sm:h-9 sm:w-9" plain /></span>
                      <span className="w-full truncate text-sm font-medium text-[var(--ui-ink)] sm:text-[15px] sm:font-bold">{team.shortName}</span>
                      <span className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border ${selected ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]" : "border-[var(--ui-border)] text-transparent group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]"}`}>
                        {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {teamError ? <p role="alert" className="mt-4 text-center text-sm text-red-600">{teamError}</p> : null}

            <div className="mt-4 flex items-center gap-2 sm:justify-between">
              <button type="button" disabled={finishing} onClick={() => finish()} className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-medium text-[var(--ui-muted)] underline underline-offset-4 transition hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)] disabled:opacity-50 sm:px-4">
                {pendingTeamId === "skip" ? "완료 중…" : "아직 최애팀이 없어요 · 건너뛰기"}
              </button>
              <button
                type="button"
                disabled={!selectedTeamId || finishing}
                onClick={() => {
                  const selectedTeam = teams.find((team) => team.id === selectedTeamId);
                  if (selectedTeam) finish(selectedTeam);
                }}
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none sm:px-5"
              >
                {finishing && pendingTeamId !== "skip" ? "적용 중…" : "선택한 팀 적용"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
