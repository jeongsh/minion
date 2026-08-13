import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { siteBaseUrl } from "@/lib/site";

// Naver 로그인 전용 콜백. Supabase의 내장 커스텀 OIDC 연동은 네이버 userinfo가
// {resultcode, response:{email,...}} 형태로 중첩돼 있어 이메일을 못 읽는 문제가 있어서,
// 토큰 교환/프로필 조회/세션 발급까지 이 라우트가 전부 직접 처리한다.
export const runtime = "nodejs";

const STATE_COOKIE = "naver_oauth_state";
const NEXT_COOKIE = "naver_oauth_next";

type NaverTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type NaverProfileResponse = {
  resultcode: string;
  message: string;
  response?: {
    id: string;
    email?: string;
    nickname?: string;
  };
};

function errorRedirect(message: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, siteBaseUrl()));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  const next = cookieStore.get(NEXT_COOKIE)?.value || "/";
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(NEXT_COOKIE);

  if (providerError) {
    return errorRedirect("네이버 로그인이 취소되었습니다.");
  }
  if (!code || !state || !savedState || state !== savedState) {
    return errorRedirect("네이버 로그인 요청이 올바르지 않습니다. 다시 시도해주세요.");
  }

  const clientId = process.env.NAVER_LOGIN_CLIENT_ID;
  const clientSecret = process.env.NAVER_LOGIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorRedirect("네이버 로그인이 아직 설정되지 않았습니다.");
  }

  const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("state", state);

  const tokenRes = await fetch(tokenUrl, { method: "GET" });
  const token = (await tokenRes.json()) as NaverTokenResponse;
  if (!tokenRes.ok || !token.access_token) {
    return errorRedirect("네이버 인증에 실패했습니다. 다시 시도해주세요.");
  }

  const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = (await profileRes.json()) as NaverProfileResponse;
  if (!profileRes.ok || profile.resultcode !== "00" || !profile.response) {
    return errorRedirect("네이버 프로필 조회에 실패했습니다. 다시 시도해주세요.");
  }

  const naverId = profile.response.id;
  const email = profile.response.email;
  const nickname = profile.response.nickname;

  if (!email) {
    return errorRedirect(
      "네이버 계정에서 이메일 제공에 동의해야 로그인할 수 있습니다. 네이버 로그인을 다시 시도해주세요.",
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: linkedProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("naver_id", naverId)
    .maybeSingle();

  let userId = linkedProfile?.id as string | undefined;

  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { provider: "custom:naver", providers: ["custom:naver"] },
      user_metadata: { nickname, naver_id: naverId },
    });

    if (createError || !created?.user) {
      if (createError && /already.*(registered|exists)/i.test(createError.message)) {
        return errorRedirect("이미 같은 이메일로 가입된 계정이 있습니다. 기존 로그인 방법을 이용해주세요.");
      }
      console.error("네이버 계정 생성 실패", createError);
      return errorRedirect("네이버 계정으로 로그인하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }

    userId = created.user.id;

    const { error: linkError } = await admin.from("profiles").update({ naver_id: naverId }).eq("id", userId);
    if (linkError) {
      console.error("naver_id 연결 실패", linkError);
    }
  } else {
    // 매직링크로 세션을 발급하는 과정에서 Supabase가 providers에 "email"을 끼워
    // 넣는 경우가 있어, 재로그인 때마다 provider 메타데이터를 네이버로 다시 맞춰
    // 프로필 화면의 로그인수단 표시/재인증 매칭이 흐트러지지 않게 한다.
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { provider: "custom:naver", providers: ["custom:naver"] },
    });
  }

  const { data: linkData, error: linkGenError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkGenError || !hashedToken) {
    console.error("로그인 링크 생성 실패", linkGenError);
    return errorRedirect("로그인 세션을 만들지 못했습니다. 잠시 후 다시 시도해주세요.");
  }

  const supabase = await createSupabaseAuthClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });

  if (verifyError) {
    console.error("네이버 로그인 세션 발급 실패", verifyError);
    return errorRedirect("로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  }

  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", siteBaseUrl()));
}
