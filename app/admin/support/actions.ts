"use server";

// 고객센터 문의 답변·상태 갱신. 답변은 사이트 내(/support 내 문의내역)에서 이용자에게
// 바로 노출되므로, 메일 발송 없이 이 액션이 곧 "답변"이다.

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import { recordOperationalEvent } from "@/lib/observability/operational-events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: boolean; error?: string };

/** 답변을 등록하고 상태를 답변완료로 바꾼다. 이용자는 /support 내 문의내역에서 바로 본다. */
export async function replySupportInquiryAction(inquiryId: string, reply: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const trimmed = reply.trim();
  if (!trimmed) return { ok: false, error: "답변 내용을 입력해주세요." };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("support_inquiries")
    .update({
      reply: trimmed,
      status: "answered",
      answered_at: new Date().toISOString(),
      answered_by: admin.id,
    })
    .eq("id", inquiryId);

  if (error) return { ok: false, error: error.message };

  await recordOperationalEvent(supabase, {
    eventType: "support_inquiry_replied",
    actorUserId: admin.id,
    targetType: "support_inquiry",
    targetId: inquiryId,
    metadata: {},
  });

  revalidatePath("/admin/support");
  revalidatePath("/support");
  return { ok: true };
}

export async function updateSupportInquiryStatusAction(
  inquiryId: string,
  status: "open" | "answered" | "closed",
  adminNote?: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  // adminNote를 넘기지 않은 호출(현재 UI의 종료/미처리 버튼)은 기존 메모를 그대로 둔다.
  // 매번 null로 덮어쓰면 다른 경로에서 남긴 메모가 상태 변경 한 번에 사라진다.
  const payload: { status: typeof status; admin_note?: string | null } = { status };
  if (adminNote !== undefined) payload.admin_note = adminNote.trim() || null;

  const { error } = await supabase
    .from("support_inquiries")
    .update(payload)
    .eq("id", inquiryId);

  if (error) return { ok: false, error: error.message };

  await recordOperationalEvent(supabase, {
    eventType: "support_inquiry_status_updated",
    actorUserId: admin.id,
    targetType: "support_inquiry",
    targetId: inquiryId,
    metadata: { status },
  });

  revalidatePath("/admin/support");
  revalidatePath("/support");
  return { ok: true };
}
