// 공유 seam: 로그인/랭크 트랙이 구현, 게시판 트랙이 소비한다.
// 쿠키 세션에서 user를 조회하고 profiles의 nickname을 합쳐 반환한다.
// 게시판 트랙은 이 시그니처에만 의존하므로 export 형태/타입은 유지한다.

import { cache } from "react";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

// 소셜 로그인(구글/카카오/네이버)은 비밀번호가 없다. app_metadata.providers 에
// "email"이 있는지로 비밀번호 보유 여부를, provider(최초 가입 provider)로 어떤
// 소셜 계정인지 판별해 비밀번호 변경/회원 탈퇴 화면 분기에 쓴다.
export type CurrentUser = {
  id: string;
  email: string | null;
  nickname: string | null;
  profileImageUrl: string | null;
  hasPassword: boolean;
  authProvider: string | null;
  lastSignInAt: string | null;
};

// layout과 각 페이지가 모두 호출하므로 요청 1회당 인증 조회를 1번으로 dedupe한다.
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  // 환경변수 미설정 등으로 클라이언트 생성에 실패하면 비로그인으로 간주.
  let supabase: Awaited<ReturnType<typeof createSupabaseAuthClient>>;
  try {
    supabase = await createSupabaseAuthClient();
  } catch {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // profiles에서 nickname을 가져온다(없을 수 있음).
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, profile_image_url")
    .eq("id", user.id)
    .maybeSingle();

  const providers = Array.isArray(user.app_metadata?.providers)
    ? (user.app_metadata.providers as string[])
    : [];

  return {
    id: user.id,
    email: user.email ?? null,
    nickname: profile?.nickname ?? null,
    profileImageUrl: profile?.profile_image_url ?? null,
    hasPassword: providers.includes("email"),
    authProvider: (user.app_metadata?.provider as string | undefined) ?? providers[0] ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
});
