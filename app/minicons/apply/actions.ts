"use server";

import { revalidatePath } from "next/cache";

import {
  MINICON_MAX_PACK_ITEMS,
  MINICON_MIN_PACK_ITEMS,
  MINICON_UPLOAD_BUCKET,
} from "@/lib/minicons/upload-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

export type UploadedMinicon = {
  name: string;
  receiptId: string;
};

type MiniconApplicationInput = {
  name: string;
  description: string;
  rightsConfirmed: boolean;
  items: UploadedMinicon[];
};

type ApplicationResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function textLength(value: string) {
  return Array.from(value).length;
}

function validReceiptIds(items: unknown[]) {
  return [...new Set(items.flatMap((item) => {
    if (
      !item
      || typeof item !== "object"
      || !("receiptId" in item)
      || typeof item.receiptId !== "string"
      || !UUID_PATTERN.test(item.receiptId)
    ) return [];

    return [item.receiptId];
  }))].slice(0, MINICON_MAX_PACK_ITEMS);
}

async function cleanupUploadReceipts(admin: AdminClient, userId: string, receiptIds: string[]) {
  const ids = [...new Set(receiptIds.filter((id) => UUID_PATTERN.test(id)))]
    .slice(0, MINICON_MAX_PACK_ITEMS);
  if (ids.length === 0) return;

  const { data, error } = await admin.rpc("request_minicon_upload_cleanup", {
    p_user_id: userId,
    p_receipt_ids: ids,
  });
  if (error) {
    console.warn("[minicons] failed to request staged upload cleanup", error.message);
    return;
  }

  const rows = (data ?? []) as { receipt_id: string; storage_path: string }[];
  if (rows.length === 0) return;

  const { error: removeError } = await admin.storage
    .from(MINICON_UPLOAD_BUCKET)
    .remove(rows.map((row) => row.storage_path));
  if (removeError) {
    console.warn("[minicons] failed to clean staged uploads", removeError.message);
    return;
  }

  const { error: completeError } = await admin.rpc("complete_minicon_upload_cleanup", {
    p_user_id: userId,
    p_receipt_ids: rows.map((row) => row.receipt_id),
  });
  if (completeError) {
    console.warn("[minicons] failed to complete staged upload cleanup", completeError.message);
  }
}

async function authenticatedUser() {
  const auth = await createSupabaseAuthClient().catch(() => null);
  if (!auth) return null;

  const { data: { user }, error } = await auth.auth.getUser();
  return error ? null : user;
}

function applicationError(message: string) {
  if (message.includes("MINICON_PENDING_LIMIT")) {
    return "검토 중인 신청은 한 번에 최대 3개까지 등록할 수 있습니다.";
  }
  if (message.includes("MINICON_RIGHTS_REQUIRED")) {
    return "등록·배포할 권리가 있는 이미지인지 확인해야 합니다.";
  }
  if (message.includes("MINICON_INVALID_UPLOADS") || message.includes("MINICON_DUPLICATE_UPLOADS")) {
    return "업로드가 만료되었거나 파일 정보가 올바르지 않습니다. 다시 업로드해 주세요.";
  }
  return "미니콘 신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export async function cleanupMiniconUploadsAction(receiptIds: string[]) {
  const user = await authenticatedUser();
  if (!user || !Array.isArray(receiptIds)) return;

  let admin: AdminClient;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return;
  }
  await cleanupUploadReceipts(admin, user.id, receiptIds);
}

export async function submitMiniconApplicationAction(
  input: MiniconApplicationInput,
): Promise<ApplicationResult> {
  const user = await authenticatedUser();
  if (!user) return { ok: false, error: "로그인 세션을 다시 확인해 주세요." };

  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const receiptIds = validReceiptIds(rawItems);
  let admin: AdminClient;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "미니콘 신청 서버 설정을 확인하지 못했습니다." };
  }

  const fail = async (error: string): Promise<ApplicationResult> => {
    await cleanupUploadReceipts(admin, user.id, receiptIds);
    return { ok: false, error };
  };

  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";

  if (textLength(name) < 1 || textLength(name) > 30) {
    return fail("패키지 이름은 1~30자로 입력하세요.");
  }
  if (textLength(description) > 300) {
    return fail("설명은 300자까지 입력할 수 있습니다.");
  }
  if (input?.rightsConfirmed !== true) {
    return fail("등록·배포할 권리가 있는 이미지인지 확인해야 합니다.");
  }
  if (rawItems.length < MINICON_MIN_PACK_ITEMS || rawItems.length > MINICON_MAX_PACK_ITEMS) {
    return fail(`미니콘은 ${MINICON_MIN_PACK_ITEMS}~${MINICON_MAX_PACK_ITEMS}개를 등록해야 합니다.`);
  }
  if (receiptIds.length !== rawItems.length) {
    return fail("같은 미니콘 파일을 중복해서 신청할 수 없습니다.");
  }

  const items = rawItems.map((item, index) => {
    const trimmedName = typeof item.name === "string" ? item.name.trim() : "";
    return {
      receiptId: item.receiptId,
      name: Array.from(trimmedName).slice(0, 20).join("") || `미니콘 ${index + 1}`,
    };
  });

  const { error } = await admin.rpc("submit_minicon_application", {
    p_user_id: user.id,
    p_name: name,
    p_description: description,
    p_rights_confirmed: true,
    p_items: items,
  });

  if (error) return fail(applicationError(error.message));

  revalidatePath("/minicons/apply");
  revalidatePath("/admin/minicons");
  return { ok: true, message: `${name} 미니콘 ${items.length}개가 검토 대기열에 등록되었습니다.` };
}
