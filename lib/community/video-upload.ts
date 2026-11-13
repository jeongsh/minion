import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COMMUNITY_UPLOAD_BUCKET,
  COMMUNITY_UPLOAD_DAILY_LIMIT,
  COMMUNITY_VIDEO_MAX_BYTES,
  COMMUNITY_VIDEO_TYPES,
  checkUploadRateLimit,
  communityUploadPrefix,
  isCommunityVideoType,
  matchesCommunityVideoSignature,
  type UploadRateLimitState,
} from "./upload-security";
import { recordOperationalEvent } from "../observability/operational-events";

type Failure = { ok: false; status: number; code: "BAD_REQUEST" | "RATE_LIMITED" | "INTERNAL"; message: string; retryAfterSeconds?: number };
export type CommunityVideoSignResult = { ok: true; path: string; token: string; signedUrl: string; url: string } | Failure;
export type CommunityVideoConfirmResult = { ok: true; path: string; url: string } | Failure;

function positiveInt(value: unknown, fallback: number) {
  const number = typeof value === "number" ? Math.round(value) : NaN;
  return Number.isFinite(number) && number > 0 && number <= 16384 ? number : fallback;
}

/**
 * Videos are too big for a serverless request body, so clients upload them
 * straight to Storage with a signed URL and then ask the server to verify.
 * Web and mobile routes share this so both enforce the same contract.
 */
export async function signCommunityVideoUpload(
  admin: SupabaseClient,
  userId: string,
  input: { contentType?: unknown; size?: unknown; width?: unknown; height?: unknown },
  rateLimitStore: Map<string, UploadRateLimitState>,
): Promise<CommunityVideoSignResult> {
  const rateLimit = checkUploadRateLimit(userId, rateLimitStore);
  if (!rateLimit.ok) {
    return { ok: false, status: 429, code: "RATE_LIMITED", message: "업로드가 너무 잦습니다. 잠시 후 다시 시도해 주세요.", retryAfterSeconds: rateLimit.retryAfterSeconds };
  }
  if (!isCommunityVideoType(input.contentType)) {
    return { ok: false, status: 400, code: "BAD_REQUEST", message: "MP4, WEBM, MOV 동영상만 첨부할 수 있습니다." };
  }
  const size = typeof input.size === "number" ? input.size : 0;
  if (!(size > 0 && size <= COMMUNITY_VIDEO_MAX_BYTES)) {
    return { ok: false, status: 400, code: "BAD_REQUEST", message: `동영상은 ${COMMUNITY_VIDEO_MAX_BYTES / 1024 / 1024}MB 이하만 첨부할 수 있습니다.` };
  }

  const storage = admin.storage.from(COMMUNITY_UPLOAD_BUCKET);
  const path = `${communityUploadPrefix(userId)}/${crypto.randomUUID()}.${COMMUNITY_VIDEO_TYPES[input.contentType]}`;
  const { data: signed, error: signError } = await storage.createSignedUploadUrl(path);
  if (signError || !signed) return { ok: false, status: 500, code: "INTERNAL", message: "동영상 업로드를 준비하지 못했습니다." };
  const { data: { publicUrl } } = storage.getPublicUrl(path);

  // 이미지와 같은 일일 한도를 쓴다. 서명 시점에 기록해 URL만 받아 가는 남용도 막는다.
  const { data: quotaRows, error: quotaError } = await admin.rpc("record_community_upload", {
    p_user_id: userId,
    p_guest_key: null,
    p_bucket_id: COMMUNITY_UPLOAD_BUCKET,
    p_object_path: path,
    p_public_url: publicUrl,
    p_original_content_type: input.contentType,
    p_stored_content_type: input.contentType,
    p_original_bytes: Math.round(size),
    p_stored_bytes: Math.round(size),
    p_width: positiveInt(input.width, 1),
    p_height: positiveInt(input.height, 1),
    p_daily_limit: COMMUNITY_UPLOAD_DAILY_LIMIT,
  });
  if (quotaError) return { ok: false, status: 500, code: "INTERNAL", message: "업로드 기록에 실패했습니다." };
  if (!quotaRows?.[0]?.allowed) {
    return { ok: false, status: 429, code: "RATE_LIMITED", message: `사진과 동영상은 하루 ${COMMUNITY_UPLOAD_DAILY_LIMIT}개까지 올릴 수 있습니다.` };
  }

  return { ok: true, path, token: signed.token, signedUrl: signed.signedUrl, url: publicUrl };
}

export async function confirmCommunityVideoUpload(admin: SupabaseClient, userId: string, rawPath: unknown): Promise<CommunityVideoConfirmResult> {
  const invalid: Failure = { ok: false, status: 400, code: "BAD_REQUEST", message: "잘못된 요청입니다." };
  const path = typeof rawPath === "string" ? rawPath : "";
  if (!path.startsWith(`${userId}/`) || path.includes("..")) return invalid;
  const extension = path.split(".").pop();
  const contentType = (Object.keys(COMMUNITY_VIDEO_TYPES) as Array<keyof typeof COMMUNITY_VIDEO_TYPES>)
    .find((type) => COMMUNITY_VIDEO_TYPES[type] === extension);
  if (!contentType) return invalid;

  const storage = admin.storage.from(COMMUNITY_UPLOAD_BUCKET);
  const { data: { publicUrl } } = storage.getPublicUrl(path);
  const head = await fetch(publicUrl, { headers: { Range: "bytes=0-15" }, cache: "no-store" }).catch(() => null);
  const bytes = head && (head.status === 206 || head.status === 200)
    ? new Uint8Array(await head.arrayBuffer()).subarray(0, 16)
    : null;
  if (!bytes || !matchesCommunityVideoSignature(bytes, contentType)) {
    await storage.remove([path]);
    return { ok: false, status: 400, code: "BAD_REQUEST", message: "올바른 동영상 파일이 아닙니다." };
  }

  await recordOperationalEvent(admin, {
    eventType: "community_video_upload",
    actorUserId: userId,
    targetType: "storage.object",
    targetId: path,
    metadata: { bucket: COMMUNITY_UPLOAD_BUCKET, contentType },
  });
  return { ok: true, path, url: publicUrl };
}
