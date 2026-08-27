"use server";

import { revalidatePath } from "next/cache";

import { setFavoriteTeamAction } from "@/app/fan/[teamSlug]/actions";
import type { ProfileActionState } from "@/lib/auth/action-state";
import { updateNicknameAction } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { DEFAULT_PROFILE_IMAGE_URLS } from "@/lib/auth/onboarding";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export async function saveOnboardingProfileAction(
  previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "로그인이 필요합니다." };

  const image = formData.get("profileImage");
  const defaultImage = String(formData.get("defaultProfileImage") ?? "");
  const hasUpload = image instanceof File && image.size > 0;
  const hasDefault = DEFAULT_PROFILE_IMAGE_URLS.has(defaultImage);

  if (!hasUpload && !hasDefault && !user.profileImageUrl) {
    return { status: "error", message: "프로필 이미지를 선택해주세요." };
  }

  return updateNicknameAction(previous, formData);
}

export async function completeOnboardingAction(input: {
  teamId?: string;
  teamSlug?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  if (input.teamId && input.teamSlug) {
    const favorite = await setFavoriteTeamAction(input.teamId, input.teamSlug, true);
    if (!favorite.ok) return { ok: false, error: favorite.error };
  }

  const supabase = await createSupabaseAuthClient();
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { ok: false, error: "온보딩 완료 상태를 저장하지 못했습니다." };

  revalidatePath("/", "layout");
  revalidatePath("/me");
  return { ok: true };
}
