import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { siteBaseUrl } from "@/lib/site";

export const runtime = "nodejs";

const STATE_COOKIE = "mobile_naver_oauth_state";
const REDIRECT_COOKIE = "mobile_naver_redirect";
const INSTALLATION_COOKIE = "mobile_naver_installation";

function safeRedirect(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "minion:") return url.toString();
    if (process.env.NODE_ENV !== "production" && (url.protocol === "exp:" || url.protocol === "exps:")) return url.toString();
  } catch { /* invalid URL */ }
  return null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectTo = safeRedirect(requestUrl.searchParams.get("redirect_to"));
  const installationId = requestUrl.searchParams.get("installation_id")?.trim() ?? "";
  const clientId = process.env.NAVER_LOGIN_CLIENT_ID;
  if (!clientId || !redirectTo || !/^[a-zA-Z0-9._:-]{8,200}$/.test(installationId)) {
    return NextResponse.redirect(new URL("/login?error=네이버 로그인 요청이 올바르지 않습니다.", siteBaseUrl()));
  }
  const state = randomBytes(24).toString("base64url");
  const store = await cookies();
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, maxAge: 600, path: "/api/mobile/v1/auth/naver" };
  store.set(STATE_COOKIE, state, options);
  store.set(REDIRECT_COOKIE, redirectTo, options);
  store.set(INSTALLATION_COOKIE, installationId, options);
  const authorizeUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", `${siteBaseUrl()}/api/mobile/v1/auth/naver/callback`);
  authorizeUrl.searchParams.set("state", state);
  return NextResponse.redirect(authorizeUrl);
}
