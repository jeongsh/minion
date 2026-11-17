import { NextResponse } from "next/server";

import { confirmCommunityVideoUpload, signCommunityVideoUpload } from "@/lib/community/video-upload";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

type Body = { action?: unknown; contentType?: unknown; size?: unknown; width?: unknown; height?: unknown; path?: unknown };

export async function POST(request: Request) {
  let auth;
  try {
    auth = await createSupabaseAuthClient();
  } catch {
    return NextResponse.json({ error: "동영상 업로드를 사용할 수 없습니다." }, { status: 500 });
  }
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "동영상은 로그인 후 첨부할 수 있습니다." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || (body.action !== "sign" && body.action !== "confirm")) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "동영상 업로드를 사용할 수 없습니다." }, { status: 500 });
  }

  const result = body.action === "sign"
    ? await signCommunityVideoUpload(admin, user.id, body, rateLimitStore)
    : await confirmCommunityVideoUpload(admin, user.id, body.path);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: result.status, headers: result.retryAfterSeconds ? { "Retry-After": String(result.retryAfterSeconds) } : undefined },
    );
  }
  const { ok: _ok, ...data } = result;
  return NextResponse.json(data);
}
