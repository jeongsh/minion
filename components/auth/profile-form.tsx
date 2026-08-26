"use client";

import { useActionState, useMemo, useState } from "react";
import { Camera } from "lucide-react";

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
    <form action={formAction} className="flex flex-col gap-3 sm:gap-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="hidden sm:inline"><RankAvatar tier={tier} src={previewUrl} alt="프로필 이미지 미리보기" fallback={initials || "MY"} size="lg" /></span>
        <div className="min-w-0 flex-1">
          <label
            htmlFor="profileImage"
            className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[13px] font-medium transition hover:bg-[var(--ui-surface-muted)] sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm"
          >
            <Camera size={14} />
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
          <p className="mt-1 text-[13px] font-medium leading-[18px] text-[var(--ui-muted)] sm:mt-2 sm:font-normal sm:leading-5">
            PNG, JPG, WEBP · 최대 5MB
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nickname" className="text-[13px] font-medium leading-[18px] sm:text-sm">
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
          className="min-h-9 rounded-lg border bg-[var(--ui-surface)] px-3 text-[13px] outline-none transition focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)] sm:min-h-11 sm:text-sm"
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

      <button type="submit" disabled={pending} className="h-9 w-full rounded-lg bg-[var(--accent)] px-5 text-[13px] font-medium text-[var(--accent-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto sm:self-start sm:text-sm">
        {pending ? "저장 중..." : "프로필 저장"}
      </button>
    </form>
  );
}
