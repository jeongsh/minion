// proxy.ts(Next 16 미들웨어)에서 세션 쿠키를 갱신하기 위한 헬퍼.
// 주어진 NextResponse(예: next() 또는 rewrite())에 갱신된 세션 쿠키를 심어 반환한다.
// 응답 객체를 새로 만들지 않으므로 rewrite 등 기존 동작을 그대로 보존한다.

import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

export async function attachRefreshedSession(
  request: NextRequest,
  response: NextResponse,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // 환경변수가 없으면 인증 비활성 상태이므로 아무것도 하지 않는다.
  if (!supabaseUrl || !publishableKey) {
    return;
  }

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          // 후속 미들웨어/핸들러가 읽을 수 있도록 요청 쿠키도 갱신.
          request.cookies.set(name, value);
          // 브라우저로 내려갈 응답 쿠키 갱신.
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser()가 세션을 검증/갱신하고 필요 시 setAll을 트리거한다.
  await supabase.auth.getUser();
}
