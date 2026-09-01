import type {
  MobileMiniconApplication,
  MobileMiniconApplicationMutationDto,
  MobileMiniconApplicationsDto,
} from "@/packages/contracts/src/mobile-v1";
import {
  MINICON_MAX_PACK_ITEMS,
  MINICON_MIN_PACK_ITEMS,
  MINICON_UPLOAD_BUCKET,
} from "@/lib/minicons/upload-security";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_PENDING_APPLICATIONS = 3;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UploadedMinicon = { name: string; receiptId: string };
type ApplicationRow = {
  id: string;
  name: string;
  description: string;
  status: string;
  cover_url: string;
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

function textLength(value: string) {
  return Array.from(value).length;
}

function validReceiptIds(items: unknown[]) {
  return [...new Set(items.flatMap((item) => {
    if (!item || typeof item !== "object" || !("receiptId" in item) || typeof item.receiptId !== "string" || !UUID_PATTERN.test(item.receiptId)) return [];
    return [item.receiptId];
  }))].slice(0, MINICON_MAX_PACK_ITEMS);
}

async function cleanupUploads(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string, receiptIds: string[]) {
  const ids = [...new Set(receiptIds.filter((id) => UUID_PATTERN.test(id)))].slice(0, MINICON_MAX_PACK_ITEMS);
  if (ids.length === 0) return;
  const { data, error } = await admin.rpc("request_minicon_upload_cleanup", { p_user_id: userId, p_receipt_ids: ids });
  if (error) return;
  const rows = (data ?? []) as { receipt_id: string; storage_path: string }[];
  if (rows.length === 0) return;
  const { error: removeError } = await admin.storage.from(MINICON_UPLOAD_BUCKET).remove(rows.map((row) => row.storage_path));
  if (removeError) return;
  await admin.rpc("complete_minicon_upload_cleanup", { p_user_id: userId, p_receipt_ids: rows.map((row) => row.receipt_id) });
}

function applicationError(message: string) {
  if (message.includes("MINICON_PENDING_LIMIT")) return "검토 중인 신청은 한 번에 최대 3개까지 등록할 수 있습니다.";
  if (message.includes("MINICON_RIGHTS_REQUIRED")) return "등록·배포할 권리가 있는 이미지인지 확인해야 합니다.";
  if (message.includes("MINICON_INVALID_UPLOADS") || message.includes("MINICON_DUPLICATE_UPLOADS")) return "업로드가 만료되었거나 파일 정보가 올바르지 않습니다. 다시 업로드해 주세요.";
  return "미니콘 신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export async function GET(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("minicon_packs")
    .select("id, name, description, status, cover_url, created_at, submitted_at, reviewed_at, review_note")
    .eq("creator_id", auth.user.id).eq("is_official", false).order("created_at", { ascending: false });
  if (error) return mobileError("INTERNAL", "신청 내역을 불러오지 못했습니다.", 500);
  const rows = (data ?? []) as ApplicationRow[];
  const counts = new Map<string, number>();
  if (rows.length > 0) {
    const { data: itemRows, error: itemError } = await admin.from("minicon_items").select("pack_id").in("pack_id", rows.map((row) => row.id));
    if (itemError) return mobileError("INTERNAL", "신청 내역을 불러오지 못했습니다.", 500);
    for (const item of (itemRows ?? []) as { pack_id: string }[]) counts.set(item.pack_id, (counts.get(item.pack_id) ?? 0) + 1);
  }
  const applications: MobileMiniconApplication[] = rows.map((row) => ({
    id: row.id, name: row.name, description: row.description, status: row.status, coverUrl: row.cover_url,
    submittedAt: row.submitted_at ?? row.created_at, reviewedAt: row.reviewed_at, reviewNote: row.review_note,
    itemCount: counts.get(row.id) ?? 0,
  }));
  const response: MobileMiniconApplicationsDto = {
    applications,
    pendingApplicationCount: applications.filter((item) => item.status === "pending_review").length,
    maxPendingApplications: MAX_PENDING_APPLICATIONS,
  };
  return mobileSuccess(response, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const input = await request.json().catch(() => null) as { name?: unknown; description?: unknown; rightsConfirmed?: unknown; items?: unknown } | null;
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const receiptIds = validReceiptIds(rawItems);
  const admin = createSupabaseAdminClient();
  const fail = async (message: string) => { await cleanupUploads(admin, auth.user.id, receiptIds); return mobileError("BAD_REQUEST", message, 400); };
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  if (textLength(name) < 1 || textLength(name) > 30) return fail("패키지 이름은 1~30자로 입력하세요.");
  if (textLength(description) > 300) return fail("설명은 300자까지 입력할 수 있습니다.");
  if (input?.rightsConfirmed !== true) return fail("등록·배포할 권리가 있는 이미지인지 확인해야 합니다.");
  if (rawItems.length < MINICON_MIN_PACK_ITEMS || rawItems.length > MINICON_MAX_PACK_ITEMS) return fail(`미니콘은 ${MINICON_MIN_PACK_ITEMS}~${MINICON_MAX_PACK_ITEMS}개를 등록해야 합니다.`);
  if (receiptIds.length !== rawItems.length) return fail("같은 미니콘 파일을 중복해서 신청할 수 없습니다.");
  const items = (rawItems as UploadedMinicon[]).map((item, index) => ({ receiptId: item.receiptId, name: Array.from(typeof item.name === "string" ? item.name.trim() : "").slice(0, 20).join("") || `미니콘 ${index + 1}` }));
  const { error } = await admin.rpc("submit_minicon_application", { p_user_id: auth.user.id, p_name: name, p_description: description, p_rights_confirmed: true, p_items: items });
  if (error) { await cleanupUploads(admin, auth.user.id, receiptIds); return mobileError("BAD_REQUEST", applicationError(error.message), 400); }
  const response: MobileMiniconApplicationMutationDto = { message: `${name} 미니콘 ${items.length}개가 검토 대기열에 등록되었습니다.` };
  return mobileSuccess(response, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const body = await request.json().catch(() => null) as { receiptIds?: unknown } | null;
  if (!Array.isArray(body?.receiptIds)) return mobileError("BAD_REQUEST", "정리할 업로드 정보를 확인하지 못했습니다.", 400);
  await cleanupUploads(createSupabaseAdminClient(), auth.user.id, body.receiptIds.filter((id): id is string => typeof id === "string"));
  return mobileSuccess({ cleaned: true }, { headers: { "Cache-Control": "private, no-store" } });
}
