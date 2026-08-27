"use client";

import Image from "next/image";
import { Camera, Check, LoaderCircle } from "lucide-react";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { completeOnboardingAction, saveOnboardingProfileAction } from "@/app/onboarding/actions";
import { RankAvatar } from "@/components/rank/rank-avatar";
import { TeamLogo } from "@/components/ui/team-logo";
import { INITIAL_PROFILE_STATE } from "@/lib/auth/action-state";
import { DEFAULT_PROFILE_IMAGES } from "@/lib/auth/onboarding";
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
  const [selectedDefault, setSelectedDefault] = useState(
    DEFAULT_PROFILE_IMAGES.some((image) => image.value === initialProfileImageUrl)
      ? initialProfileImageUrl
      : "",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialProfileImageUrl);
  const [nickname, setNickname] = useState(initialNickname);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [finishing, startFinishing] = useTransition();
  const step = profileState.status === "success" ? 2 : 1;

  const initials = useMemo(() => nickname.trim().slice(0, 2).toUpperCase() || "MY", [nickname]);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 px-3 py-3 backdrop-blur-[2px] sm:px-4 sm:py-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className={`my-auto w-full overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-2xl transition-[max-width] ${step === 1 ? "max-w-[480px]" : "max-w-[680px]"}`}
      >
        <div className="border-b border-[var(--ui-border)] px-5 pb-3 pt-4 sm:px-6">
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
          <form action={profileAction} className="px-5 py-5 sm:px-6">
            <div className="text-center">
              <h1 id="onboarding-title" className="font-paperozi text-[24px] leading-[1.35] text-[var(--ui-ink)]">프로필을 완성해주세요</h1>
              <p className="mx-auto mt-2 max-w-[420px] text-base font-normal leading-6 text-[var(--ui-muted)]">커뮤니티에서 사용할 닉네임과 프로필 이미지는 필수예요.</p>
            </div>

            <div className="mt-4 flex justify-center">
              <RankAvatar tier="bronze" src={previewUrl} alt="선택한 프로필 이미지" fallback={initials} size="profile" />
            </div>

            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-[var(--ui-ink)]">기본 프로필 이미지</legend>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {DEFAULT_PROFILE_IMAGES.map((image) => {
                  const selected = selectedDefault === image.value;
                  return (
                    <button
                      key={image.value}
                      type="button"
                      aria-label={`${image.label} 선택`}
                      aria-pressed={selected}
                      onClick={() => {
                        setSelectedDefault(image.value);
                        setPreviewUrl(image.value);
                      }}
                      className={`relative aspect-square overflow-hidden rounded-xl border-2 transition ${selected ? "border-[var(--accent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_20%,transparent)]" : "border-transparent hover:border-[var(--ui-border)]"}`}
                    >
                      <Image src={image.value} alt="" fill sizes="96px" className="object-cover" />
                      {selected ? <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]"><Check size={14} /></span> : null}
                    </button>
                  );
                })}
              </div>
              <input type="hidden" name="defaultProfileImage" value={selectedDefault ?? ""} />
            </fieldset>

            <label className="mt-2.5 flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-4 text-sm font-medium text-[var(--ui-ink)] transition hover:border-[var(--accent)]">
              <Camera size={17} />
              내 사진으로 설정
              <input
                type="file"
                name="profileImage"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setSelectedDefault("");
                  setPreviewUrl(URL.createObjectURL(file));
                }}
              />
            </label>

            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="onboarding-nickname" className="text-sm font-medium text-[var(--ui-ink)]">닉네임</label>
              <input
                id="onboarding-nickname"
                name="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                minLength={2}
                maxLength={16}
                required
                className="min-h-11 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3.5 text-base outline-none transition focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
              />
              <p className="text-[13px] font-normal text-[var(--ui-muted)]">2~16자 · 다른 사용자와 중복될 수 없습니다.</p>
            </div>

            {profileState.status === "error" ? <p role="alert" className="mt-4 text-sm text-red-600">{profileState.message}</p> : null}

            <button type="submit" disabled={profilePending} className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-foreground)] transition hover:opacity-90 disabled:opacity-60">
              {profilePending ? <><LoaderCircle size={17} className="mr-2 animate-spin" />저장 중…</> : "다음"}
            </button>
          </form>
        ) : (
          <div className="px-5 py-5 sm:px-6">
            <div className="text-center">
              <h1 id="onboarding-title" className="font-paperozi text-[24px] leading-[1.35] text-[var(--ui-ink)]">응원할 팀을 골라주세요</h1>
              <p className="mx-auto mt-2 max-w-[600px] text-base font-normal leading-6 text-[var(--ui-muted)] text-balance">최애팀 소식과 팬페이지를 더 빠르게 만날 수 있어요. 아직 없다면 건너뛰어도 괜찮아요.</p>
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="최애팀 선택">
              {teams.map((team) => {
                const pending = pendingTeamId === team.id;
                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      disabled={finishing}
                      onClick={() => finish(team)}
                      className="group relative flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 py-2 transition hover:border-[var(--accent)] hover:bg-[var(--ui-card-hover)] disabled:opacity-55"
                      aria-label={`${team.name}을 최애팀으로 선택`}
                    >
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-white p-1.5"><TeamLogo team={team} size="h-9 w-9" plain /></span>
                      <span className="w-full truncate text-[15px] font-bold text-[var(--ui-ink)]">{team.shortName}</span>
                      <span className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border ${pending ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]" : "border-[var(--ui-border)] text-transparent group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]"}`}>
                        {pending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {teamError ? <p role="alert" className="mt-4 text-center text-sm text-red-600">{teamError}</p> : null}

            <div className="mt-3 flex justify-center sm:justify-end">
              <button type="button" disabled={finishing} onClick={() => finish()} className="min-h-11 rounded-xl px-4 text-sm font-medium text-[var(--ui-muted)] underline underline-offset-4 transition hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)] disabled:opacity-50">
                {pendingTeamId === "skip" ? "완료 중…" : "아직 최애팀이 없어요 · 건너뛰기"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
