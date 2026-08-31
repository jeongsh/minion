import { NextResponse } from "next/server";
import sharp from "sharp";

import { isAdminUser } from "@/lib/auth/admin";
import {
  MINICON_MAX_MULTIPART_BODY_BYTES,
  readBoundedMiniconFormData,
} from "@/lib/minicons/bounded-multipart";
import {
  MINICON_UPLOAD_BUCKET,
  validateMiniconImage,
} from "@/lib/minicons/upload-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MINICON_MAX_MULTIPART_BODY_BYTES) {
    return NextResponse.json({ error: "미니콘은 파일당 2MB 이하여야 합니다." }, { status: 413 });
  }

  const auth = await createSupabaseAuthClient().catch(() => null);
  if (!auth) return NextResponse.json({ error: "업로드 설정을 확인하지 못했습니다." }, { status: 500 });

  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdminUser(user)) return NextResponse.json({ error: "관리자만 미니콘을 등록할 수 있습니다." }, { status: 403 });

  const parsed = await readBoundedMiniconFormData(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const file = parsed.formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "업로드할 파일이 없습니다." }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const validation = validateMiniconImage(bytes, file.type);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  try {
    const metadata = await sharp(bytes, { animated: true }).metadata();
    if (metadata.width !== 200 || metadata.height !== 200) {
      return NextResponse.json({ error: "미니콘 이미지는 정확히 200×200px이어야 합니다." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "손상된 이미지 파일입니다." }, { status: 400 });
  }

  const extension = validation.image.extension;
  const objectPath = `${user.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const admin = createSupabaseAdminClient();
  const { error: uploadError } = await admin.storage.from(MINICON_UPLOAD_BUCKET).upload(objectPath, bytes, {
    contentType: validation.image.contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from(MINICON_UPLOAD_BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({
    url: publicUrl,
    path: objectPath,
    mimeType: validation.image.contentType,
    byteSize: bytes.byteLength,
    width: validation.image.width,
    height: validation.image.height,
  });
}
