import { NextResponse } from "next/server";

import {
  COMMUNITY_UPLOAD_BUCKET,
  COMMUNITY_UPLOAD_DAILY_LIMIT,
  COMMUNITY_VIDEO_MAX_BYTES,
  COMMUNITY_VIDEO_TYPES,
  checkUploadRateLimit,
  communityUploadPrefix,
  isCommunityVideoType,
  matchesCommunityVideoSignature,
} from "@/lib/community/upload-security";
import { recordOperationalEvent } from "@/lib/observability/operational-events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

type SignBody = { action: "sign"; contentType?: unknown; size?: unknown; width?: unknown; height?: unknown };
type ConfirmBody = { action: "confirm"; path?: unknown };

function positiveInt(value: unknown, fallback: number) {
  const number = typeof value === "number" ? Math.round(value) : NaN;
  return Number.isFinite(number) && number > 0 && number <= 16384 ? number : fallback;
}

/**
 * Videos are too big for a serverless request body, so the browser uploads
 * them straight to Storage with a signed URL, then asks us to verify the file.
 */
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

  const body = (await request.json().catch(() => null)) as SignBody | ConfirmBody | null;
  if (!body || (body.action !== "sign" && body.action !== "confirm")) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "동영상 업로드를 사용할 수 없습니다." }, { status: 500 });
  }
  const storage = admin.storage.from(COMMUNITY_UPLOAD_BUCKET);

  if (body.action === "sign") {
    const rateLimit = checkUploadRateLimit(user.id, rateLimitStore);
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "업로드가 너무 잦습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }
    if (!isCommunityVideoType(body.contentType)) {
      return NextResponse.json({ error: "MP4, WEBM, MOV 동영상만 첨부할 수 있습니다." }, { status: 400 });
    }
    const size = typeof body.size === "number" ? body.size : 0;
    if (!(size > 0 && size <= COMMUNITY_VIDEO_MAX_BYTES)) {
      return NextResponse.json({ error: `동영상은 ${COMMUNITY_VIDEO_MAX_BYTES / 1024 / 1024}MB 이하만 첨부할 수 있습니다.` }, { status: 400 });
    }

    const objectPath = `${communityUploadPrefix(user.id)}/${crypto.randomUUID()}.${COMMUNITY_VIDEO_TYPES[body.contentType]}`;
    const { data: signed, error: signError } = await storage.createSignedUploadUrl(objectPath);
    if (signError || !signed) {
      return NextResponse.json({ error: "동영상 업로드를 준비하지 못했습니다." }, { status: 500 });
    }
    const {
      data: { publicUrl },
    } = storage.getPublicUrl(objectPath);

    // 이미지와 같은 일일 한도를 쓴다. 서명 시점에 기록해 URL만 받아 가는 남용도 막는다.
    const { data: quotaRows, error: quotaError } = await admin.rpc("record_community_upload", {
      p_user_id: user.id,
      p_guest_key: null,
      p_bucket_id: COMMUNITY_UPLOAD_BUCKET,
      p_object_path: objectPath,
      p_public_url: publicUrl,
      p_original_content_type: body.contentType,
      p_stored_content_type: body.contentType,
      p_original_bytes: Math.round(size),
      p_stored_bytes: Math.round(size),
      p_width: positiveInt(body.width, 1),
      p_height: positiveInt(body.height, 1),
      p_daily_limit: COMMUNITY_UPLOAD_DAILY_LIMIT,
    });
    if (quotaError) return NextResponse.json({ error: "업로드 기록에 실패했습니다." }, { status: 500 });
    if (!quotaRows?.[0]?.allowed) {
      return NextResponse.json({ error: `사진과 동영상은 하루 ${COMMUNITY_UPLOAD_DAILY_LIMIT}개까지 올릴 수 있습니다.` }, { status: 429 });
    }

    return NextResponse.json({ path: objectPath, token: signed.token, signedUrl: signed.signedUrl, url: publicUrl });
  }

  const path = typeof body.path === "string" ? body.path : "";
  const ownPrefix = `${user.id}/`;
  if (!path.startsWith(ownPrefix) || path.includes("..")) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const extension = path.split(".").pop();
  const contentType = (Object.keys(COMMUNITY_VIDEO_TYPES) as Array<keyof typeof COMMUNITY_VIDEO_TYPES>)
    .find((type) => COMMUNITY_VIDEO_TYPES[type] === extension);
  if (!contentType) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const {
    data: { publicUrl },
  } = storage.getPublicUrl(path);
  const head = await fetch(publicUrl, { headers: { Range: "bytes=0-15" }, cache: "no-store" }).catch(() => null);
  const bytes = head && (head.status === 206 || head.status === 200)
    ? new Uint8Array(await head.arrayBuffer()).subarray(0, 16)
    : null;
  if (!bytes || !matchesCommunityVideoSignature(bytes, contentType)) {
    await storage.remove([path]);
    return NextResponse.json({ error: "올바른 동영상 파일이 아닙니다." }, { status: 400 });
  }

  await recordOperationalEvent(admin, {
    eventType: "community_video_upload",
    actorUserId: user.id,
    targetType: "storage.object",
    targetId: path,
    metadata: { bucket: COMMUNITY_UPLOAD_BUCKET, contentType },
  });

  return NextResponse.json({ url: publicUrl, path });
}
