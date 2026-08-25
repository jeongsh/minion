import sharp from "sharp";

import type { MobileCommunityUploadDto } from "@/packages/contracts/src/mobile-v1";
import {
  COMMUNITY_UPLOAD_BUCKET,
  COMMUNITY_UPLOAD_DAILY_LIMIT,
  checkUploadRateLimit,
  communityUploadPrefix,
  validateCommunityImage,
} from "@/lib/community/upload-security";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";
import { recordOperationalEvent } from "@/lib/observability/operational-events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인하면 이미지를 첨부할 수 있습니다.", 401);
  const rateLimit = checkUploadRateLimit(auth.user.id, rateLimitStore);
  if (!rateLimit.ok) return mobileError("RATE_LIMITED", "이미지 업로드가 너무 잦습니다. 잠시 후 다시 시도해주세요.", 429);
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return mobileError("BAD_REQUEST", "업로드할 이미지가 없습니다.", 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  const validation = validateCommunityImage(bytes, file.type);
  if (!validation.ok) return mobileError("BAD_REQUEST", validation.error, validation.status);

  try {
    const prepared = validation.image.contentType === "image/gif"
      ? { bytes, contentType: validation.image.contentType, extension: validation.image.extension, height: validation.image.height, transformed: false, width: validation.image.width }
      : await sharp(bytes).rotate().resize({ fit: "inside", height: 2560, width: 2560, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer({ resolveWithObject: true }).then((result) => ({ bytes: result.data, contentType: "image/webp", extension: "webp", height: result.info.height, transformed: true, width: result.info.width }));
    const admin = createSupabaseAdminClient();
    const objectPath = `${communityUploadPrefix(auth.user.id)}/${crypto.randomUUID()}.${prepared.extension}`;
    const upload = await admin.storage.from(COMMUNITY_UPLOAD_BUCKET).upload(objectPath, prepared.bytes, { cacheControl: "31536000", contentType: prepared.contentType, upsert: false });
    if (upload.error) return mobileError("INTERNAL", "이미지 업로드에 실패했습니다.", 500);
    const { data: { publicUrl } } = admin.storage.from(COMMUNITY_UPLOAD_BUCKET).getPublicUrl(objectPath);
    const quota = await admin.rpc("record_community_upload", {
      p_bucket_id: COMMUNITY_UPLOAD_BUCKET,
      p_daily_limit: COMMUNITY_UPLOAD_DAILY_LIMIT,
      p_height: prepared.height,
      p_object_path: objectPath,
      p_original_bytes: bytes.byteLength,
      p_original_content_type: validation.image.contentType,
      p_public_url: publicUrl,
      p_stored_bytes: prepared.bytes.byteLength,
      p_stored_content_type: prepared.contentType,
      p_user_id: auth.user.id,
      p_width: prepared.width,
    });
    if (quota.error || !quota.data?.[0]?.allowed) {
      await admin.storage.from(COMMUNITY_UPLOAD_BUCKET).remove([objectPath]);
      return mobileError("RATE_LIMITED", `하루에 이미지는 ${COMMUNITY_UPLOAD_DAILY_LIMIT}개까지 업로드할 수 있습니다.`, 429);
    }
    await recordOperationalEvent(admin, {
      actorUserId: auth.user.id,
      eventType: "community_image_upload",
      metadata: { bucket: COMMUNITY_UPLOAD_BUCKET, contentType: prepared.contentType, originalBytes: bytes.byteLength, storedBytes: prepared.bytes.byteLength, transformed: prepared.transformed },
      targetId: objectPath,
      targetType: "storage.object",
    });
    const data: MobileCommunityUploadDto = { height: prepared.height, path: objectPath, url: publicUrl, width: prepared.width };
    return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" }, status: 201 });
  } catch {
    return mobileError("INTERNAL", "이미지 업로드에 실패했습니다.", 500);
  }
}
