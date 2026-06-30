// @supabase/ssr 기반 쿠키 인증 클라이언트.
// 서버 컴포넌트 / route handler / 서버 액션에서 로그인 세션을 읽고 쓴다.
// 주의: 기존 server.ts(읽기 전용 publishable 클라이언트, lib/data/lck.ts 사용)는 건드리지 않는다.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase URL and publishable key are required for auth.");
  }

  return { supabaseUrl, publishableKey };
}

// Next 16: cookies()는 async. 서버 컴포넌트/액션/route handler 모두에서 사용 가능.
// 서버 컴포넌트 렌더 중에는 쿠키 쓰기가 불가능하므로 set 실패를 조용히 무시한다
// (세션 갱신은 proxy.ts 미들웨어에서 처리).
export async function createSupabaseAuthClient() {
  const { supabaseUrl, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트에서 호출된 경우 set이 막힌다. 미들웨어가 세션을 갱신하므로 무시.
        }
      },
    },
  });
}
