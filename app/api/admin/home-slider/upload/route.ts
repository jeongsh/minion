import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { resizeImageForWeb } from "@/lib/images/resize-for-web";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "home-hero-slides";

// 히어로 배너는 홈 최상단에서 크게 노출되므로 화질은 넉넉히 유지하되(긴 변 1920px),
// 관리자가 무압축 원본(수 MB짜리 카메라 사진 등)을 그대로 올려도 저장 전에 한 번 줄인다.
// 이 라우트는 서버 액션 본문 기본 용량 제한(1MB)을 피하려고 Route Handler로 구현했다.
export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
  }

  const slideId = ((formData?.get("slide_id") as string | null) ?? "").trim() || randomUUID();
  const resized = await resizeImageForWeb(Buffer.from(await file.arrayBuffer()), file.type, { maxEdge: 1920 });
  const fallbackExtension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const extension = resized.transformed ? resized.extension : fallbackExtension;
  const path = `${slideId}/${Date.now()}.${extension}`;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, resized.bytes, {
    contentType: resized.contentType,
    cacheControl: "31536000",
    upsert: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
