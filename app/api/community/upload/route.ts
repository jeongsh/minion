import { NextResponse } from "next/server";

import {
  COMMUNITY_UPLOAD_BUCKET,
  COMMUNITY_UPLOAD_DAILY_LIMIT,
  checkUploadRateLimit,
  communityUploadPrefix,
  validateCommunityImage,
} from "@/lib/community/upload-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

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

  const objectPath = `${prefix}/${crypto.randomUUID()}.${validation.image.extension}`;
  const { error: uploadError } = await admin.storage
    .from(COMMUNITY_UPLOAD_BUCKET)
    .upload(objectPath, bytes, { contentType: validation.image.contentType, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message || "Image upload failed." }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(COMMUNITY_UPLOAD_BUCKET).getPublicUrl(objectPath);

  return NextResponse.json({ url: publicUrl });
}
