"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  AttendanceState,
  AuthActionState,
  ProfileActionState,
} from "@/lib/auth/action-state";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordLpEvent } from "@/lib/rank/record-lp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { POLICY_VERSION } from "@/lib/site";

const PROFILE_AVATAR_BUCKET = "profile-avatars";
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function profileImageExtension(type: string, name: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/jpeg") return "jpg";
  const fromName = name.split(".").pop()?.toLowerCase();
  return fromName && /^[a-z0-9]+$/.test(fromName) ? fromName : "jpg";
}

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const ageConfirmed = formData.get("ageConfirmed") === "on";
  const termsAccepted = formData.get("termsAccepted") === "on";
  const privacyAccepted = formData.get("privacyAccepted") === "on";

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }
  if (!ageConfirmed || !termsAccepted || !privacyAccepted) {
    return { error: "만 14세 이상 확인과 필수 약관에 모두 동의해주세요." };
  }

  const supabase = await createSupabaseAuthClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        age_confirmed: true,
        terms_accepted: true,
        privacy_accepted: true,
        policy_version: POLICY_VERSION,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/me");
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }

  const supabase = await createSupabaseAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  revalidatePath("/", "layout");
  redirect("/me");
}

export async function updateNicknameAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "로그인이 필요합니다." };
  }

  const nickname = String(formData.get("nickname") ?? "").trim();
  if (nickname.length < 2 || nickname.length > 20) {
    return { status: "error", message: "닉네임은 2~20자로 입력해주세요." };
  }

  const image = formData.get("profileImage");
  let profileImageUrl: string | null | undefined;

  if (image instanceof File && image.size > 0) {
    if (!PROFILE_IMAGE_TYPES.has(image.type)) {
      return { status: "error", message: "프로필 이미지는 PNG, JPG, WEBP만 업로드할 수 있습니다." };
    }
    if (image.size > MAX_PROFILE_IMAGE_BYTES) {
      return { status: "error", message: "프로필 이미지는 5MB 이하만 업로드할 수 있습니다." };
    }

    let admin;
    try {
      admin = createSupabaseAdminClient();
    } catch {
      return { status: "error", message: "프로필 이미지 업로드 설정이 필요합니다." };
    }

    const objectPath = `${user.id}/${crypto.randomUUID()}.${profileImageExtension(image.type, image.name)}`;
    const arrayBuffer = await image.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(objectPath, Buffer.from(arrayBuffer), {
        contentType: image.type,
        upsert: false,
      });

    if (uploadError) {
      return { status: "error", message: uploadError.message || "프로필 이미지 업로드에 실패했습니다." };
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(objectPath);
    profileImageUrl = publicUrl;
  }

  const supabase = await createSupabaseAuthClient();
  const updates: { nickname: string; profile_image_url?: string } = { nickname };
  if (profileImageUrl) {
    updates.profile_image_url = profileImageUrl;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "이미 사용 중인 닉네임입니다." };
    }
    return { status: "error", message: "프로필 변경에 실패했습니다." };
  }

  revalidatePath("/me");
  revalidatePath("/me/profile");
  revalidatePath("/", "layout");
  return { status: "success", message: "프로필이 저장되었습니다." };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseAuthClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function checkInAction(
  _prev: AttendanceState,
): Promise<AttendanceState> {
  const supabase = await createSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated", message: "로그인이 필요합니다." };
  }

  const { error } = await supabase
    .from("attendance_checks")
    .insert({ user_id: user.id });

  if (error) {
    if (error.code === "23505") {
      return { status: "already", message: "오늘은 이미 출석체크를 했어요." };
    }
    return { status: "error", message: "출석체크에 실패했습니다." };
  }

  await recordLpEvent({ userId: user.id, reason: "attendance" });

  revalidatePath("/me");
  return { status: "success", message: "출석체크 완료! +10 LP" };
}
