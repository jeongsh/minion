// 공유 seam: 로그인/랭크 트랙이 구현, 게시판 트랙이 소비한다.
// 쿠키 세션에서 user를 조회하고 profiles의 nickname을 합쳐 반환한다.
// 게시판 트랙은 이 시그니처에만 의존하므로 export 형태/타입은 유지한다.

import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export type CurrentUser = {
  id: string;
  email: string | null;
  nickname: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
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
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    nickname: profile?.nickname ?? null,
  };
}
