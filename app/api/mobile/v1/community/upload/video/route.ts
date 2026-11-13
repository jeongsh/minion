import type { MobileCommunityVideoConfirmDto, MobileCommunityVideoSignDto } from "@/packages/contracts/src/mobile-v1";
import { confirmCommunityVideoUpload, signCommunityVideoUpload } from "@/lib/community/video-upload";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

type Body = { action?: unknown; contentType?: unknown; size?: unknown; width?: unknown; height?: unknown; path?: unknown };

// 웹 /api/community/upload/video와 같은 계약: 서명 URL 발급 후 업로드된 파일을 검증한다.
export async function POST(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "동영상은 로그인 후 첨부할 수 있습니다.", 401);
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || (body.action !== "sign" && body.action !== "confirm")) return mobileError("BAD_REQUEST", "잘못된 요청입니다.", 400);

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return mobileError("INTERNAL", "동영상 업로드를 사용할 수 없습니다.", 500);
  }
  const headers = { "Cache-Control": "private, no-store" };
  if (body.action === "sign") {
    const result = await signCommunityVideoUpload(admin, auth.user.id, body, rateLimitStore);
    if (!result.ok) return mobileError(result.code, result.message, result.status);
    const data: MobileCommunityVideoSignDto = { path: result.path, signedUrl: result.signedUrl, token: result.token, url: result.url };
    return mobileSuccess(data, { headers, status: 201 });
  }
  const result = await confirmCommunityVideoUpload(admin, auth.user.id, body.path);
  if (!result.ok) return mobileError(result.code, result.message, result.status);
  const data: MobileCommunityVideoConfirmDto = { path: result.path, url: result.url };
  return mobileSuccess(data, { headers });
}
