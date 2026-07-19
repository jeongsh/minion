import { NextResponse } from "next/server";
import sharp from "sharp";

import {
  COMMUNITY_UPLOAD_BUCKET,
  COMMUNITY_UPLOAD_DAILY_LIMIT,
  checkUploadRateLimit,
  communityUploadPrefix,
  validateCommunityImage,
} from "@/lib/community/upload-security";
import { recordOperationalEvent } from "@/lib/observability/operational-events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const COMMUNITY_UPLOAD_TARGET_MAX_EDGE = 2560;
const COMMUNITY_UPLOAD_WEBP_QUALITY = 84;

async function prepareCommunityImage(bytes: Buffer, validation: ReturnType<typeof validateCommunityImage> & { ok: true }) {
  if (validation.image.contentType === "image/gif") {
    return {
      bytes,
      contentType: validation.image.contentType,
      extension: validation.image.extension,
      width: validation.image.width,
      height: validation.image.height,
      transformed: false,
    };
  }

  const result = await sharp(bytes)
    .rotate()
    .resize({
      width: COMMUNITY_UPLOAD_TARGET_MAX_EDGE,
      height: COMMUNITY_UPLOAD_TARGET_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: COMMUNITY_UPLOAD_WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    bytes: result.data,
    contentType: "image/webp",
    extension: "webp",
    width: result.info.width,
    height: result.info.height,
    transformed: true,
  };
}

export async function POST(request: Request) {
  let auth;
  try {
    auth = await createSupabaseAuthClient();
  } catch {
    return NextResponse.json({ error: "Image upload is not configured." }, { status: 500 });
  }

  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to upload images." }, { status: 401 });
  }

  const rateLimit = checkUploadRateLimit(user.id, rateLimitStore);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Image upload rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const validation = validateCommunityImage(bytes, file.type);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Image upload is not configured." }, { status: 500 });
  }

  const prefix = communityUploadPrefix(user.id);
  const { data: dailyObjects, error: listError } = await admin.storage
    .from(COMMUNITY_UPLOAD_BUCKET)
    .list(prefix, { limit: COMMUNITY_UPLOAD_DAILY_LIMIT + 1 });

  if (listError) {
    return NextResponse.json({ error: listError.message || "Failed to verify image upload limits." }, { status: 500 });
  }

  if ((dailyObjects?.length ?? 0) >= COMMUNITY_UPLOAD_DAILY_LIMIT) {
    return NextResponse.json(
      { error: `You can upload up to ${COMMUNITY_UPLOAD_DAILY_LIMIT} images per day.` },
      { status: 429 },
    );
  }

  const prepared = await prepareCommunityImage(bytes, validation);
  const objectPath = `${prefix}/${crypto.randomUUID()}.${prepared.extension}`;
  const { error: uploadError } = await admin.storage
    .from(COMMUNITY_UPLOAD_BUCKET)
    .upload(objectPath, prepared.bytes, { contentType: prepared.contentType, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message || "Image upload failed." }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(COMMUNITY_UPLOAD_BUCKET).getPublicUrl(objectPath);

  await admin.from("community_uploads").insert({
    user_id: user.id,
    bucket_id: COMMUNITY_UPLOAD_BUCKET,
    object_path: objectPath,
    public_url: publicUrl,
    original_content_type: validation.image.contentType,
    stored_content_type: prepared.contentType,
    original_bytes: bytes.byteLength,
    stored_bytes: prepared.bytes.byteLength,
    width: prepared.width,
    height: prepared.height,
    status: "uploaded",
  });

  await recordOperationalEvent(admin, {
    eventType: "community_image_upload",
    actorUserId: user.id,
    targetType: "storage.object",
    targetId: objectPath,
    metadata: {
      bucket: COMMUNITY_UPLOAD_BUCKET,
      originalBytes: bytes.byteLength,
      storedBytes: prepared.bytes.byteLength,
      transformed: prepared.transformed,
      contentType: prepared.contentType,
    },
  });

  return NextResponse.json({ url: publicUrl });
}
