import { NextResponse } from "next/server";
import sharp from "sharp";

import {
  MINICON_MAX_MULTIPART_BODY_BYTES,
  readBoundedMiniconFormData,
} from "@/lib/minicons/bounded-multipart";
import {
  MINICON_MAX_BYTES,
  MINICON_SIZE,
  MINICON_UPLOAD_BUCKET,
  validateMiniconImage,
} from "@/lib/minicons/upload-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function reservationError(message: string) {
  if (message.includes("MINICON_PENDING_LIMIT")) {
    return { error: "검토 중인 신청은 한 번에 최대 3개까지 등록할 수 있습니다.", status: 429 };
  }
  if (message.includes("MINICON_DAILY_UPLOAD_LIMIT")) {
    return { error: "오늘 업로드할 수 있는 미니콘 수를 모두 사용했습니다. 내일 다시 시도해 주세요.", status: 429 };
  }
  return { error: "업로드 가능 여부를 확인하지 못했습니다.", status: 503 };
}

async function removeReservedObject(
  admin: AdminClient,
  userId: string,
  receiptId: string,
  storagePath: string,
) {
  const { error: requestError } = await admin.rpc("request_minicon_upload_cleanup", {
    p_user_id: userId,
    p_receipt_ids: [receiptId],
  });
  const { error: removeError } = await admin.storage.from(MINICON_UPLOAD_BUCKET).remove([storagePath]);

  if (!requestError && !removeError) {
    await admin.rpc("complete_minicon_upload_cleanup", {
      p_user_id: userId,
      p_receipt_ids: [receiptId],
    });
    return;
  }

  console.warn("[minicons] failed to clean incomplete upload", {
    requestError: requestError?.message,
    removeError: removeError?.message,
  });
}

export async function POST(request: Request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MINICON_MAX_MULTIPART_BODY_BYTES) {
    return NextResponse.json({ error: "미니콘은 파일당 2MB 이하여야 합니다." }, { status: 413 });
  }

  const auth = await createSupabaseAuthClient().catch(() => null);
  if (!auth) {
    return NextResponse.json({ error: "업로드 설정을 확인하지 못했습니다." }, { status: 500 });
  }

  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let admin: AdminClient;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "업로드 서버 설정을 확인하지 못했습니다." }, { status: 500 });
  }

  const parsed = await readBoundedMiniconFormData(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const file = parsed.formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "업로드할 파일이 없습니다." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MINICON_MAX_BYTES) {
    return NextResponse.json({ error: "미니콘은 파일당 2MB 이하여야 합니다." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const validation = validateMiniconImage(bytes, file.type);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const metadata = await sharp(bytes, { animated: true }).metadata();
    if (metadata.width !== MINICON_SIZE || metadata.height !== MINICON_SIZE) {
      return NextResponse.json({ error: "미니콘 이미지는 정확히 200×200px이어야 합니다." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "손상된 이미지 파일입니다." }, { status: 400 });
  }

  const { data: reservationData, error: reservationRpcError } = await admin.rpc(
    "reserve_minicon_upload",
    {
      p_user_id: user.id,
      p_extension: validation.image.extension,
      p_mime_type: validation.image.contentType,
      p_byte_size: bytes.byteLength,
      p_width: validation.image.width,
      p_height: validation.image.height,
    },
  );
  if (reservationRpcError) {
    const response = reservationError(reservationRpcError.message);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const reservation = ((reservationData ?? []) as {
    receipt_id: string;
    storage_path: string;
  }[])[0];
  if (!reservation) {
    return NextResponse.json({ error: "업로드 공간을 예약하지 못했습니다." }, { status: 503 });
  }

  const { error: uploadError } = await admin.storage
    .from(MINICON_UPLOAD_BUCKET)
    .upload(reservation.storage_path, bytes, {
      contentType: validation.image.contentType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    await admin.rpc("fail_minicon_upload", {
      p_user_id: user.id,
      p_receipt_id: reservation.receipt_id,
    });
    return NextResponse.json({ error: "미니콘 파일을 저장하지 못했습니다." }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage
    .from(MINICON_UPLOAD_BUCKET)
    .getPublicUrl(reservation.storage_path);
  const { data: completed, error: completionError } = await admin.rpc("complete_minicon_upload", {
    p_user_id: user.id,
    p_receipt_id: reservation.receipt_id,
    p_public_url: publicUrl,
  });

  if (completionError || completed !== true) {
    await removeReservedObject(
      admin,
      user.id,
      reservation.receipt_id,
      reservation.storage_path,
    );
    return NextResponse.json({ error: "업로드 확인 정보를 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ receiptId: reservation.receipt_id });
}
