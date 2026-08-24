import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as { code?: string; installationId?: string } | null;
  if (!input?.code || !input.installationId) return mobileError("BAD_REQUEST", "세션 교환 요청이 올바르지 않습니다.", 400);
  const admin = createSupabaseAdminClient();
  const codeHash = createHash("sha256").update(input.code).digest("hex");
  const now = new Date().toISOString();
  const { data: consumed, error: consumeError } = await admin
    .from("mobile_auth_exchange_codes")
    .update({ consumed_at: now })
    .eq("code_hash", codeHash)
    .eq("installation_id", input.installationId)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("user_id")
    .maybeSingle();
  if (consumeError || !consumed) return mobileError("UNAUTHENTICATED", "로그인 코드가 만료되었거나 이미 사용되었습니다.", 401);
  const { data: userResult } = await admin.auth.admin.getUserById(consumed.user_id);
  const email = userResult.user?.email;
  if (!email) return mobileError("UNAUTHENTICATED", "연결된 계정을 찾을 수 없습니다.", 401);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link.properties?.hashed_token) return mobileError("INTERNAL", "로그인 세션을 만들지 못했습니다.", 500);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return mobileError("INTERNAL", "인증 서버 설정이 필요합니다.", 500);
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (error || !data.session) return mobileError("INTERNAL", "로그인 세션을 만들지 못했습니다.", 500);
  await admin.auth.admin.updateUserById(consumed.user_id, { app_metadata: { provider: "custom:naver", providers: ["custom:naver"] } });
  return mobileSuccess({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token }, { headers: { "Cache-Control": "no-store" } });
}
