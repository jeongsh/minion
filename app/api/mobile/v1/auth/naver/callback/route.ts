import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const STATE_COOKIE = "mobile_naver_oauth_state";
const REDIRECT_COOKIE = "mobile_naver_redirect";
const INSTALLATION_COOKIE = "mobile_naver_installation";

type NaverToken = { access_token?: string };
type NaverProfile = { resultcode?: string; response?: { id: string; email?: string; nickname?: string } };

function callbackRedirect(base: string, params: Record<string, string>) {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const savedState = store.get(STATE_COOKIE)?.value;
  const redirectTo = store.get(REDIRECT_COOKIE)?.value;
  const installationId = store.get(INSTALLATION_COOKIE)?.value;
  store.delete(STATE_COOKIE); store.delete(REDIRECT_COOKIE); store.delete(INSTALLATION_COOKIE);
  if (!redirectTo) return NextResponse.json({ error: "Missing redirect" }, { status: 400 });
  const fail = (message: string) => callbackRedirect(redirectTo, { error: "naver_oauth_failed", error_description: message });
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code || !state || !savedState || state !== savedState || !installationId) return fail("네이버 로그인이 취소되었거나 요청이 만료되었습니다.");
  const clientId = process.env.NAVER_LOGIN_CLIENT_ID;
  const clientSecret = process.env.NAVER_LOGIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("네이버 로그인이 아직 설정되지 않았습니다.");

  const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
  tokenUrl.search = new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, code, state }).toString();
  const tokenResponse = await fetch(tokenUrl);
  const token = await tokenResponse.json() as NaverToken;
  if (!tokenResponse.ok || !token.access_token) return fail("네이버 인증에 실패했습니다.");
  const profileResponse = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { Authorization: `Bearer ${token.access_token}` } });
  const naverProfile = await profileResponse.json() as NaverProfile;
  const naver = naverProfile.response;
  if (!profileResponse.ok || naverProfile.resultcode !== "00" || !naver?.id || !naver.email) return fail("네이버 계정의 이메일 제공 동의가 필요합니다.");

  const admin = createSupabaseAdminClient();
  const { data: linked } = await admin.from("profiles").select("id").eq("naver_id", naver.id).maybeSingle();
  let userId = linked?.id as string | undefined;
  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: naver.email,
      email_confirm: true,
      app_metadata: { provider: "custom:naver", providers: ["custom:naver"] },
      user_metadata: { nickname: naver.nickname, naver_id: naver.id },
    });
    if (error || !created.user) {
      return fail(/already.*(registered|exists)/i.test(error?.message ?? "") ? "같은 이메일의 기존 계정으로 먼저 로그인해주세요." : "네이버 계정을 연결하지 못했습니다.");
    }
    userId = created.user.id;
    await admin.from("profiles").update({ naver_id: naver.id }).eq("id", userId);
  }
  await admin.auth.admin.updateUserById(userId, { app_metadata: { provider: "custom:naver", providers: ["custom:naver"] } });
  const rawCode = randomBytes(32).toString("base64url");
  const codeHash = createHash("sha256").update(rawCode).digest("hex");
  const { error: insertError } = await admin.from("mobile_auth_exchange_codes").insert({
    code_hash: codeHash,
    user_id: userId,
    installation_id: installationId,
    expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
  });
  if (insertError) return fail("로그인 세션을 준비하지 못했습니다.");
  return callbackRedirect(redirectTo, { code: rawCode, provider: "naver" });
}
