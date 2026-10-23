"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ProfileActionState } from "@/lib/auth/action-state";
import { ACCOUNT_LINK_COOKIE, ACCOUNT_LINK_COOKIE_OPTIONS, isLinkedProvider, LINK_PROVIDERS } from "@/lib/auth/linked-accounts";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { siteBaseUrl } from "@/lib/site";

export async function linkSocialAccountAction(_previous: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const provider = LINK_PROVIDERS.find((item) => item.value === formData.get("provider"))?.value;
  if (!provider) return { status: "error", message: "연동할 SNS를 선택해주세요." };
  const supabase = await createSupabaseAuthClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { status: "error", message: "다시 로그인한 뒤 연동해주세요." };
  if (isLinkedProvider(user, provider)) return { status: "error", message: "이미 연동된 계정입니다." };
  const store = await cookies();
  store.set(ACCOUNT_LINK_COOKIE, JSON.stringify({ userId: user.id, provider }), ACCOUNT_LINK_COOKIE_OPTIONS);
  if (provider === "naver") redirect("/auth/naver?link=1");

  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: {
      redirectTo: `${siteBaseUrl()}/auth/link/callback`,
      skipBrowserRedirect: true,
      ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
    },
  });
  if (error || !data.url) {
    store.delete(ACCOUNT_LINK_COOKIE);
    return { status: "error", message: error?.code === "manual_linking_disabled"
      ? "SNS 연동 설정이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요."
      : "SNS 연동을 시작하지 못했습니다. 다시 시도해주세요." };
  }
  redirect(data.url);
}
