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
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <RankAvatar
          tier={tier}
          src={previewUrl}
          alt="프로필 이미지 미리보기"
          fallback={initials || "MY"}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor="profileImage"
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 text-sm font-bold transition hover:bg-[var(--ui-surface-muted)]"
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
          <p className="mt-2 text-[13px] text-[var(--ui-muted)]">
            PNG, JPG, WEBP 이미지를 5MB 이하로 업로드할 수 있습니다.
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

      <Button type="submit" disabled={pending} className="h-11 self-start rounded-lg px-5 font-bold">
        {pending ? "저장 중..." : "프로필 저장"}
      </Button>
    </form>
  );
}
