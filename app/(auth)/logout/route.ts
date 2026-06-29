import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

// 폼/링크 기반 로그아웃 폴백 라우트. 서버 액션(signOutAction)이 기본 경로지만
// 직접 호출(GET/POST)도 지원한다.
async function handle(request: NextRequest) {
  const supabase = await createSupabaseAuthClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url));
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}
