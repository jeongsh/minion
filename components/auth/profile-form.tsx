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
            className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--ui-border)] px-3 text-sm font-black hover:bg-[var(--ui-surface-muted)]"
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
          maxLength={20}
          required
          className="rounded-md border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--border)" }}
        />
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          2~20자, 다른 사용자와 중복될 수 없습니다.
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

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "저장 중..." : "프로필 저장"}
      </Button>
    </form>
  );
}
