"use client";

import { useActionState, useMemo, useState } from "react";
import { Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RankAvatar } from "@/components/rank/rank-avatar";
import { INITIAL_PROFILE_STATE } from "@/lib/auth/action-state";
import { updateNicknameAction } from "@/lib/auth/actions";
import type { Tier } from "@/lib/rank/config";

export function ProfileForm({
  initialNickname,
  initialProfileImageUrl = null,
  tier,
}: {
  initialNickname: string;
  initialProfileImageUrl?: string | null;
  tier: Tier;
}) {
  const [state, formAction, pending] = useActionState(
    updateNicknameAction,
    INITIAL_PROFILE_STATE,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialProfileImageUrl);

  const initials = useMemo(() => {
    const trimmed = initialNickname.trim();
    return trimmed ? trimmed.slice(0, 2).toUpperCase() : "MY";
  }, [initialNickname]);

  return (
    <form action={formAction} className="flex flex-col gap-4 sm:gap-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="sm:hidden"><RankAvatar tier={tier} src={previewUrl} alt="프로필 이미지 미리보기" fallback={initials || "MY"} size="profile" /></span>
        <span className="hidden sm:inline"><RankAvatar tier={tier} src={previewUrl} alt="프로필 이미지 미리보기" fallback={initials || "MY"} size="lg" /></span>
        <div className="min-w-0 flex-1">
          <label
            htmlFor="profileImage"
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[13px] font-semibold transition hover:bg-[var(--ui-surface-muted)] sm:gap-2 sm:px-4 sm:text-sm sm:font-bold"
          >
            <Camera size={16} />
            프로필 이미지 변경
          </label>
          <input
            id="profileImage"
            name="profileImage"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setPreviewUrl(URL.createObjectURL(file));
            }}
          />
          <p className="mt-1.5 text-[12px] font-medium leading-[18px] text-[var(--ui-muted)] sm:mt-2 sm:text-[13px] sm:font-normal">
            PNG, JPG, WEBP · 최대 5MB
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nickname" className="text-sm font-semibold">
          닉네임
        </label>
        <input
          id="nickname"
          name="nickname"
          type="text"
          defaultValue={initialNickname}
          minLength={2}
          maxLength={16}
          required
          className="min-h-11 rounded-lg border bg-[var(--ui-surface)] px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
          style={{ borderColor: "var(--border)" }}
        />
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          2~16자, 다른 사용자와 중복될 수 없습니다.
        </p>
      </div>

      {state.status !== "idle" && state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="text-sm"
          style={{ color: state.status === "error" ? "#dc2626" : "#16a34a" }}
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 w-full rounded-lg px-5 font-bold sm:w-auto sm:self-start">
        {pending ? "저장 중..." : "프로필 저장"}
      </Button>
    </form>
  );
}
