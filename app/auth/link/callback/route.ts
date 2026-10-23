import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCOUNT_LINK_COOKIE, isLinkedProvider } from "@/lib/auth/linked-accounts";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { siteBaseUrl } from "@/lib/site";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const raw = store.get(ACCOUNT_LINK_COOKIE)?.value;
  store.delete(ACCOUNT_LINK_COOKIE);
  const back = (error?: string) => NextResponse.redirect(new URL(
    `/me?${error ? `linkError=${encodeURIComponent(error)}` : "linked=1"}#profile`, siteBaseUrl(),
  ));
  let intent: { userId?: string; provider?: string };
  try { intent = JSON.parse(raw ?? "{}"); } catch { return back("연동 요청이 만료되었습니다. 다시 시도해주세요."); }
  if (!intent.userId || (intent.provider !== "google" && intent.provider !== "kakao")) return back("연동 요청이 만료되었습니다. 다시 시도해주세요.");
  if (url.searchParams.has("error")) return back("SNS 연동이 취소되었거나 이미 다른 계정에 연결되어 있습니다.");
  const supabase = await createSupabaseAuthClient();
  const before = await supabase.auth.getUser();
  if (before.data.user?.id !== intent.userId) return back("로그인 계정이 변경되었습니다. 다시 연동해주세요.");
  const code = url.searchParams.get("code");
  if (!code) return back("SNS 인증 결과를 확인하지 못했습니다. 다시 시도해주세요.");
  const result = await supabase.auth.exchangeCodeForSession(code);
  if (result.error) return back("SNS 인증에 실패했습니다. 다시 시도해주세요.");
  const verified = await supabase.auth.getUser();
  if (verified.data.user?.id !== intent.userId || !isLinkedProvider(verified.data.user, intent.provider)) {
    await supabase.auth.signOut({ scope: "local" });
    return back("연동된 계정을 확인하지 못했습니다. 다시 로그인해주세요.");
  }
  return back();
}
