"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import {
  MINICON_MAX_BYTES,
  MINICON_MAX_PACK_ITEMS,
  MINICON_MIN_PACK_ITEMS,
  MINICON_UPLOAD_BUCKET,
} from "@/lib/minicons/upload-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const REVIEW_NOTE_MAX_LENGTH = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UploadedMinicon = {
  name: string;
  path: string;
  mimeType: string;
  byteSize: number;
};

export type MiniconPackReviewInput = {
  packId: string;
  status: "published" | "rejected";
  reviewNote?: string;
};

export type MiniconPackReviewResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function revalidateMiniconPages() {
  revalidatePath("/admin/minicons");
  revalidatePath("/minicons");
  revalidatePath("/minicons/apply");
  revalidatePath("/me/minicons");
  revalidatePath("/community", "layout");
}

/** 검토 대기 중인 사용자 미니콘만 승인 또는 반려한다. */
export async function reviewMiniconPackAction(
  input: MiniconPackReviewInput,
): Promise<MiniconPackReviewResult> {
  if (!input || typeof input.packId !== "string") {
    return { ok: false, error: "미니콘 신청 정보를 확인하지 못했어요." };
  }

  const packId = input.packId.trim();
  if (!UUID_PATTERN.test(packId)) {
    return { ok: false, error: "미니콘 신청 정보를 확인하지 못했어요." };
  }
  if (input.status !== "published" && input.status !== "rejected") {
    return { ok: false, error: "심사 결과를 다시 선택해 주세요." };
  }
  if (input.reviewNote !== undefined && typeof input.reviewNote !== "string") {
    return { ok: false, error: "심사 메모를 확인하지 못했어요." };
  }

  const reviewNote = input.reviewNote?.trim() || null;
  if (reviewNote && reviewNote.length > REVIEW_NOTE_MAX_LENGTH) {
    return { ok: false, error: `심사 메모는 ${REVIEW_NOTE_MAX_LENGTH}자까지 입력할 수 있어요.` };
  }
  if (input.status === "rejected" && !reviewNote) {
    return { ok: false, error: "반려할 때는 신청자가 확인할 수 있는 사유를 입력해 주세요." };
  }

  const reviewer = await requireAdmin();
  const reviewedAt = new Date().toISOString();
  const admin = createSupabaseAdminClient();
  const reviewValues = input.status === "published"
    ? {
        status: "published",
        published_at: reviewedAt,
        is_official: false,
        review_note: reviewNote,
        reviewed_at: reviewedAt,
        reviewed_by: reviewer.id,
        updated_at: reviewedAt,
      }
    : {
        status: "rejected",
        published_at: null,
        review_note: reviewNote,
        reviewed_at: reviewedAt,
        reviewed_by: reviewer.id,
        updated_at: reviewedAt,
      };

  const { data: reviewedPack, error } = await admin
    .from("minicon_packs")
    .update(reviewValues)
    .eq("id", packId)
    .eq("status", "pending_review")
    .select("id, name")
    .maybeSingle();

  if (error) {
    console.error("[minicons] pack review failed", error);
    return { ok: false, error: "미니콘 신청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  if (!reviewedPack) {
    return { ok: false, error: "이미 처리되었거나 찾을 수 없는 미니콘 신청이에요." };
  }

  revalidateMiniconPages();
  return {
    ok: true,
    message: input.status === "published"
      ? `${reviewedPack.name} 미니콘을 공개했어요.`
      : `${reviewedPack.name} 미니콘 신청을 반려했어요.`,
  };
}

export async function createMiniconPackAction(input: {
  name: string;
  description: string;
  rightsConfirmed: boolean;
  items: UploadedMinicon[];
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const actor = await requireAdmin();
  const name = input.name.trim();
  const description = input.description.trim();

  if (name.length < 1 || name.length > 30) return { ok: false, error: "패키지 이름은 1~30자로 입력하세요." };
  if (description.length > 300) return { ok: false, error: "설명은 300자까지 입력할 수 있습니다." };
  if (!input.rightsConfirmed) return { ok: false, error: "저작물 이용 권리를 확인해야 합니다." };
  if (input.items.length < MINICON_MIN_PACK_ITEMS || input.items.length > MINICON_MAX_PACK_ITEMS) {
    return { ok: false, error: `미니콘은 ${MINICON_MIN_PACK_ITEMS}~${MINICON_MAX_PACK_ITEMS}개를 등록해야 합니다.` };
  }

  const allowedTypes = new Set(["image/png", "image/jpeg", "image/gif"]);
  const ownerPrefix = `${actor.id}/`;
  for (const item of input.items) {
    if (!item.path.startsWith(ownerPrefix) || !allowedTypes.has(item.mimeType) || item.byteSize <= 0 || item.byteSize > MINICON_MAX_BYTES) {
      return { ok: false, error: "업로드된 미니콘 파일 정보가 올바르지 않습니다." };
    }
  }

  const admin = createSupabaseAdminClient();
  const uploadedPaths = input.items.map((item) => item.path);
  const publicUrls = new Map(uploadedPaths.map((path) => [
    path,
    admin.storage.from(MINICON_UPLOAD_BUCKET).getPublicUrl(path).data.publicUrl,
  ]));
  const slug = `minicon-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
  const { data: pack, error: packError } = await admin.from("minicon_packs").insert({
    slug,
    name,
    description,
    creator_id: actor.id,
    status: "published",
    cover_url: publicUrls.get(input.items[0].path)!,
    is_official: true,
    published_at: new Date().toISOString(),
  }).select("id").single();

  if (packError || !pack) {
    await admin.storage.from(MINICON_UPLOAD_BUCKET).remove(uploadedPaths);
    return { ok: false, error: packError?.message ?? "미니콘 패키지를 만들지 못했습니다." };
  }

  const { error: itemError } = await admin.from("minicon_items").insert(input.items.map((item, index) => ({
    pack_id: (pack as { id: string }).id,
    name: item.name.trim().slice(0, 20) || `미니콘 ${index + 1}`,
    image_url: publicUrls.get(item.path)!,
    storage_path: item.path,
    mime_type: item.mimeType,
    byte_size: item.byteSize,
    width: 200,
    height: 200,
    sort_order: index,
  })));

  if (itemError) {
    await admin.from("minicon_packs").delete().eq("id", (pack as { id: string }).id);
    await admin.storage.from(MINICON_UPLOAD_BUCKET).remove(uploadedPaths);
    return { ok: false, error: itemError.message };
  }

  revalidateMiniconPages();
  return { ok: true, message: `${name} 미니콘 ${input.items.length}개를 공개했습니다.` };
}
