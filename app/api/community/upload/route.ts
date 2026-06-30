import { NextResponse } from "next/server";

import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "community-media";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function extensionFor(type: string, name: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/jpeg") return "jpg";
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  return "jpg";
}

// 게시판 에디터 이미지 업로드. 로그인 세션을 확인하고, service-role 로 공개 버킷에 올린 뒤 공개 URL 을 돌려준다.
export async function POST(request: Request) {
  let auth;
  try {
    auth = await createSupabaseAuthClient();
  } catch {
    return NextResponse.json({ error: "이미지 업로드 설정이 필요합니다." }, { status: 500 });
  }

  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "이미지를 업로드하려면 로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "업로드할 파일이 없습니다." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "PNG, JPG, WEBP, GIF 이미지만 업로드할 수 있습니다." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "이미지는 20MB 이하만 업로드할 수 있습니다." }, { status: 400 });
  }

  const objectPath = `${user.id}/${crypto.randomUUID()}.${extensionFor(file.type, file.name)}`;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "이미지 업로드 설정이 필요합니다." }, { status: 500 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, Buffer.from(arrayBuffer), { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message || "이미지 업로드에 실패했습니다." }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(objectPath);

  return NextResponse.json({ url: publicUrl });
}
