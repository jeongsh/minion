"use server";

// 로그인/회원가입/로그아웃 + 출석체크 서버 액션.
// 회원가입 시 nickname을 메타데이터로 넘기고, profiles 행은 DB 트리거(handle_new_user)가 생성한다.
// 가입 시작 등급은 bronze(트리거 기본값).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { recordLpEvent } from "@/lib/rank/record-lp";
import type {
  AttendanceState,
  AuthActionState,
  ProfileActionState,
} from "@/lib/auth/action-state";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }

  const supabase = await createSupabaseAuthClient();

  // 닉네임 등 프로필 정보는 가입 후 프로필 관리에서 설정한다.
  // 트리거(handle_new_user)가 이메일 local-part로 임시 닉네임을 만든다.
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  // 이메일 확인이 꺼져 있으면 즉시 세션이 생성된다. 켜져 있으면 확인 후 로그인 필요.
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

// 프로필 관리: 닉네임 설정/수정. RLS상 본인 프로필만 update(쿠키 세션 클라이언트).
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

  const supabase = await createSupabaseAuthClient();
  const { error } = await supabase
    .from("profiles")
    .update({ nickname })
    .eq("id", user.id);

  if (error) {
    // 23505 = unique_violation → 이미 사용 중인 닉네임.
    if (error.code === "23505") {
      return { status: "error", message: "이미 사용 중인 닉네임입니다." };
    }
    return { status: "error", message: "닉네임 변경에 실패했습니다." };
  }

  revalidatePath("/me");
  revalidatePath("/me/profile");
  return { status: "success", message: "닉네임이 변경되었습니다." };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseAuthClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// 출석체크: 하루 1회. attendance_checks insert 성공 시 LP +10.
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

  // (user_id, check_date) unique 제약으로 하루 1회만 성공.
  const { error } = await supabase
    .from("attendance_checks")
    .insert({ user_id: user.id });

  if (error) {
    // 23505 = unique_violation → 이미 출첵함.
    if (error.code === "23505") {
      return { status: "already", message: "오늘은 이미 출석체크를 했어요." };
    }
    return { status: "error", message: "출석체크에 실패했습니다." };
  }

  await recordLpEvent({ userId: user.id, reason: "attendance" });

  revalidatePath("/me");
  return { status: "success", message: "출석체크 완료! +10 LP" };
}
