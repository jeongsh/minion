import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { siteBaseUrl } from "@/lib/site";

// Supabase의 내장 커스텀 OIDC 연동이 네이버의 비표준 userinfo 응답(email이 최상위가
// 아니라 response.email 안에 중첩됨)을 못 읽어서, 네이버 로그인만 이 앱이 직접
// 처리한다. 여기서는 네이버 인증 화면으로 보내기 전에 CSRF 방지용 state를 만들어
// 짧게 사는 쿠키에 저장해두고, 콜백(app/auth/naver/callback)에서 그 값과 대조한다.
export const runtime = "nodejs";

const STATE_COOKIE = "naver_oauth_state";
const NEXT_COOKIE = "naver_oauth_next";

export async function GET(request: Request) {
  const clientId = process.env.NAVER_LOGIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("네이버 로그인이 아직 설정되지 않았습니다.")}`, siteBaseUrl()),
    );
  }

  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/";
  const state = randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  cookieStore.set(STATE_COOKIE, state, cookieOptions);
  cookieStore.set(NEXT_COOKIE, next.startsWith("/") ? next : "/", cookieOptions);

  const authorizeUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", `${siteBaseUrl()}/auth/naver/callback`);
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl);
}
