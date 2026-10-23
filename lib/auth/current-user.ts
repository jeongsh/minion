// 공유 seam: 로그인/랭크 트랙이 구현, 게시판 트랙이 소비한다.
// 쿠키 세션에서 user를 조회하고 profiles의 nickname을 합쳐 반환한다.
// 게시판 트랙은 이 시그니처에만 의존하므로 export 형태/타입은 유지한다.

import { cache } from "react";
import { getVerifiedAuth } from "@/lib/auth/verified-user";
import { hasEmailPassword } from "@/lib/auth/linked-accounts";

// 네이버의 세션 발급용 email identity를 비밀번호 로그인과 구분한다.
// provider(최초 가입 수단)는 비밀번호 변경/회원 탈퇴 화면 분기에 사용한다.
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
  const auth = await getVerifiedAuth();
  if (!auth) return null;
  const { supabase, user } = auth;

  // profiles에서 nickname을 가져온다(없을 수 있음).
  const readProfile = () => supabase.from("profiles")
    .select("nickname, profile_image_url").eq("id", user.id).maybeSingle();
  let result = await readProfile();
  if (result.error) result = await readProfile();
  if (result.error) throw new Error("프로필을 불러오지 못했습니다.", { cause: result.error });
  const profile = result.data;

  const providers = Array.isArray(user.app_metadata?.providers)
    ? (user.app_metadata.providers as string[])
    : [];

  return {
    id: user.id,
    email: user.email ?? null,
    nickname: profile?.nickname ?? null,
    profileImageUrl: profile?.profile_image_url ?? null,
    hasPassword: hasEmailPassword(user),
    authProvider: (user.app_metadata?.provider as string | undefined) ?? providers[0] ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
});
