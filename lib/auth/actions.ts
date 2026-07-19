"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  AttendanceState,
  AuthActionState,
  DeleteAccountState,
  PasswordActionState,
  ProfileActionState,
} from "@/lib/auth/action-state";
import { DELETE_ACCOUNT_CONFIRM_TEXT } from "@/lib/auth/action-state";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordLpEvent } from "@/lib/rank/record-lp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { POLICY_VERSION, siteBaseUrl } from "@/lib/site";

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

export async function requestPasswordResetAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "이메일을 입력해주세요." };
  }

  const supabase = await createSupabaseAuthClient();
  const redirectTo = `${siteBaseUrl()}/auth/callback?next=/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return { error: error.message };
  }

  return {
    error: null,
    message: "계정이 존재하면 비밀번호 재설정 메일을 발송했습니다.",
  };
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || !confirmPassword) {
    return { error: "새 비밀번호를 입력해주세요." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }
  if (password !== confirmPassword) {
    return { error: "비밀번호가 서로 일치하지 않습니다." };
  }

  const supabase = await createSupabaseAuthClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message || "비밀번호 재설정에 실패했습니다." };
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

// 현재 비밀번호를 다시 검증한 뒤 새 비밀번호로 교체한다.
// (세션만으로 변경을 허용하면 자리를 비운 사이 탈취된 브라우저로 계정을 뺏길 수 있다.)
export async function changePasswordAction(
  _prev: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "로그인이 필요합니다." };
  }
  if (!user.email) {
    return { status: "error", message: "이메일 정보가 없어 비밀번호를 변경할 수 없습니다." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) {
    return { status: "error", message: "현재 비밀번호와 새 비밀번호를 입력해주세요." };
  }
  if (newPassword.length < 6) {
    return { status: "error", message: "새 비밀번호는 6자 이상이어야 합니다." };
  }
  if (newPassword !== confirmPassword) {
    return { status: "error", message: "새 비밀번호가 서로 일치하지 않습니다." };
  }
  if (newPassword === currentPassword) {
    return { status: "error", message: "현재 비밀번호와 다른 비밀번호를 입력해주세요." };
  }

  const supabase = await createSupabaseAuthClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyError) {
    return { status: "error", message: "현재 비밀번호가 올바르지 않습니다." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { status: "error", message: error.message || "비밀번호 변경에 실패했습니다." };
  }

  return { status: "success", message: "비밀번호가 변경되었습니다." };
}

// 회원 탈퇴: 비밀번호 재확인 후 auth 계정을 삭제한다.
// profiles 는 auth.users 에 on delete cascade 로 묶여 있어 랭크/출석/승부예측 기록이 함께 지워지고,
// community_posts/comments 의 author_id 는 FK 가 없어 글은 남고 작성자만 익명으로 표시된다.
export async function deleteAccountAction(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "로그인이 필요합니다." };
  }
  if (!user.email) {
    return { status: "error", message: "이메일 정보가 없어 탈퇴를 진행할 수 없습니다." };
  }

  const password = String(formData.get("password") ?? "");
  const confirmText = String(formData.get("confirmText") ?? "").trim();

  if (!password) {
    return { status: "error", message: "비밀번호를 입력해주세요." };
  }
  if (confirmText !== DELETE_ACCOUNT_CONFIRM_TEXT) {
    return {
      status: "error",
      message: `확인 문구를 정확히 입력해주세요. ("${DELETE_ACCOUNT_CONFIRM_TEXT}")`,
    };
  }

  const supabase = await createSupabaseAuthClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (verifyError) {
    return { status: "error", message: "비밀번호가 올바르지 않습니다." };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { status: "error", message: "탈퇴 처리 설정이 필요합니다. 관리자에게 문의해주세요." };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return { status: "error", message: error.message || "회원 탈퇴에 실패했습니다." };
  }

  // 계정이 사라진 뒤에도 쿠키 세션은 남으므로 명시적으로 정리한다.
  await supabase.auth.signOut().catch(() => undefined);

  revalidatePath("/", "layout");
  redirect("/");
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
