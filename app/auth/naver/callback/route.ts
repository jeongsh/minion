import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { siteBaseUrl } from "@/lib/site";
import { resolveNaverAccount } from "@/lib/auth/naver-account";
import { ACCOUNT_LINK_COOKIE } from "@/lib/auth/linked-accounts";
import { safeOnboardingNext } from "@/lib/auth/onboarding";

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
  const rawIntent = cookieStore.get(ACCOUNT_LINK_COOKIE)?.value;
  cookieStore.delete(ACCOUNT_LINK_COOKIE);
  let linkIntent: { userId?: string; provider?: string } = {};
  try { linkIntent = JSON.parse(rawIntent ?? "{}"); } catch {
    return errorRedirect("연동 요청이 올바르지 않습니다. 다시 시도해주세요.");
  }
  const linking = next === "/me#profile";
  const fail = (message: string) => linking
    ? NextResponse.redirect(new URL(`/me?linkError=${encodeURIComponent(message)}#profile`, siteBaseUrl()))
    : errorRedirect(message);
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(NEXT_COOKIE);

  if (linking && (linkIntent.provider !== "naver" || !linkIntent.userId)) {
    return fail("연동 요청이 만료되었습니다. 다시 시도해주세요.");
  }

  if (providerError) {
    return fail("네이버 로그인이 취소되었습니다.");
  }
  if (!code || !state || !savedState || state !== savedState) {
    return fail("네이버 로그인 요청이 올바르지 않습니다. 다시 시도해주세요.");
  }

  const clientId = process.env.NAVER_LOGIN_CLIENT_ID;
  const clientSecret = process.env.NAVER_LOGIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return fail("네이버 로그인이 아직 설정되지 않았습니다.");
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
    return fail("네이버 인증에 실패했습니다. 다시 시도해주세요.");
  }

  const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = (await profileRes.json()) as NaverProfileResponse;
  if (!profileRes.ok || profile.resultcode !== "00" || !profile.response) {
    return fail("네이버 프로필 조회에 실패했습니다. 다시 시도해주세요.");
  }

  const naver = profile.response;
  if (!naver.id || !naver.email) {
    return fail("네이버 계정에서 이메일 제공에 동의해야 로그인할 수 있습니다.");
  }
  const supabase = await createSupabaseAuthClient();
  if (linking) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== linkIntent.userId) return fail("로그인 계정이 변경되었습니다. 다시 연동해주세요.");
  }
  let account;
  try {
    account = await resolveNaverAccount({ id: naver.id, email: naver.email, nickname: naver.nickname }, linking ? linkIntent.userId : undefined);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "네이버 계정을 연결하지 못했습니다.");
  }
  if (linking) {
    return NextResponse.redirect(new URL("/me?linked=1#profile", siteBaseUrl()));
  }
  const userId = account.id;
  const email = account.email;
  if (!email) return fail("연결된 계정의 이메일을 확인하지 못했습니다.");
  const admin = createSupabaseAdminClient();

  const { data: linkData, error: linkGenError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkGenError || !hashedToken || linkData.user?.id !== userId) {
    console.error("로그인 링크 생성 실패", linkGenError);
    return fail("로그인 세션을 만들지 못했습니다. 잠시 후 다시 시도해주세요.");
  }

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });

  if (verifyError) {
    console.error("네이버 로그인 세션 발급 실패", verifyError);
    return fail("로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  }
  if (verified.user?.id !== userId) {
    await supabase.auth.signOut({ scope: "local" });
    return fail("연결된 계정을 확인하지 못했습니다. 다시 로그인해주세요.");
  }

  const { data: onboardingProfile, error: onboardingError } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();
  if (!onboardingError && onboardingProfile && !onboardingProfile.onboarding_completed_at) {
    const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/onboarding/") ? next : "/me";
    const suffix = safeNext === "/me" ? "" : `?next=${encodeURIComponent(safeNext)}`;
    return NextResponse.redirect(new URL(`/onboarding/favorite-team${suffix}`, siteBaseUrl()));
  }

  return NextResponse.redirect(new URL(safeOnboardingNext(next, "/"), siteBaseUrl()));
}
