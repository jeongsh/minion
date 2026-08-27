import { NextResponse } from "next/server";

import { siteBaseUrl } from "@/lib/site";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

// Supabase/provider가 영어로 내려주는 에러를 사용자가 이해할 수 있는 한국어로 옮긴다.
function translateCallbackError(message: string): string {
  if (/getting user email/i.test(message)) {
    // 네이버는 휴대폰 번호만으로도 가입이 가능해서, 이메일이 등록 안 된 계정은
    // 동의를 다 해도 이메일 자체를 못 넘겨준다 — 설정 문제가 아니라 그 계정에
    // 이메일이 없는 것.
    return "선택하신 계정에 이메일이 등록되어 있지 않아 로그인할 수 없습니다. 계정 설정에서 이메일을 등록한 뒤 다시 시도해주세요.";
  }
  return message;
}

function loginErrorRedirect(message: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(translateCallbackError(message))}`, siteBaseUrl()),
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  // provider(구글/카카오/네이버 등)가 로그인을 거부하거나 사용자가 동의 화면에서
  // 취소하면 code 대신 error/error_description으로 돌아온다. 이전엔 이걸 그냥
  // 무시하고 next(보통 홈)로 리다이렉트해서, 실패한 건지 성공한 건지 알 수 없이
  // 조용히 메인으로만 튕기는 것처럼 보였다.
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError) {
    return loginErrorRedirect(providerError);
  }

  if (code) {
    const supabase = await createSupabaseAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return loginErrorRedirect(error.message);
    }

    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!profileError && profile && !profile.onboarding_completed_at) {
        const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/onboarding/") ? next : "/me";
        const suffix = safeNext === "/me" ? "" : `?next=${encodeURIComponent(safeNext)}`;
        return NextResponse.redirect(new URL(`/onboarding/favorite-team${suffix}`, siteBaseUrl()));
      }
    }
  }

  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", siteBaseUrl()));
}
