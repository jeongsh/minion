"use server";

// 대문(헤더) 변경 요청 검토. 승인/반려는 상태만 바꾸고, 실제 적용은 별도 액션이다.
// 승인 = "투표 공지에 올릴 후보로 인정"이지 곧바로 대문이 바뀌는 것은 아니다.

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import { COMMUNITY_UPLOAD_BUCKET } from "@/lib/community/upload-security";
import { kstWeekStart } from "@/lib/fan/fan-header";
import { recordOperationalEvent } from "@/lib/observability/operational-events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: boolean; error?: string };

export async function reviewFanHeaderRequestAction(
  candidateId: string,
  status: "approved" | "rejected",
  note?: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("fan_header_candidates")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
      review_note: note?.trim() || null,
    })
    .eq("id", candidateId);

  if (error) return { ok: false, error: error.message };

  await recordOperationalEvent(supabase, {
    eventType: status === "approved" ? "fan_header_request_approved" : "fan_header_request_rejected",
    actorUserId: admin.id,
    targetType: "fan_header_candidate",
    targetId: candidateId,
    metadata: { note: note ?? null },
  });

  revalidatePath("/admin/fan-headers");
  return { ok: true };
}

/** 승인된 후보를 실제 대문으로 적용한다. 투표 결과를 운영진이 반영하는 경로. */
export async function applyFanHeaderAction(candidateId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { data: candidate } = await supabase
    .from("fan_header_candidates")
    .select("id, team_id, status, deleted_at, blinded_at, teams(fan_site_host)")
    .eq("id", candidateId)
    .maybeSingle();

  if (!candidate || candidate.deleted_at || candidate.blinded_at) {
    return { ok: false, error: "적용할 수 없는 요청이에요." };
  }
  if (candidate.status !== "approved") {
    return { ok: false, error: "승인된 요청만 적용할 수 있어요." };
  }

  const { error } = await supabase.from("fan_header_selections").upsert(
    {
      team_id: candidate.team_id,
      week_start: kstWeekStart(),
      candidate_id: candidate.id,
      selected_at: new Date().toISOString(),
    },
    { onConflict: "team_id,week_start" },
  );

  if (error) return { ok: false, error: error.message };

  await recordOperationalEvent(supabase, {
    eventType: "fan_header_applied",
    actorUserId: admin.id,
    targetType: "fan_header_candidate",
    targetId: candidate.id,
    metadata: { teamId: candidate.team_id },
  });

  // 대문은 팬페이지 모든 화면 상단에 걸리므로 레이아웃 단위로 무효화한다.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 반려된 요청의 이미지를 스토리지에서 정리한다. */
export async function purgeFanHeaderRequestAction(candidateId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const { data: candidate } = await supabase
    .from("fan_header_candidates")
    .select("id, image_path, status")
    .eq("id", candidateId)
    .maybeSingle();

  if (!candidate) return { ok: false, error: "요청을 찾을 수 없어요." };

  const { error } = await supabase
    .from("fan_header_candidates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", candidateId);

  if (error) return { ok: false, error: error.message };

  await supabase.storage.from(COMMUNITY_UPLOAD_BUCKET).remove([candidate.image_path]);

  await recordOperationalEvent(supabase, {
    eventType: "fan_header_request_purged",
    actorUserId: admin.id,
    targetType: "fan_header_candidate",
    targetId: candidateId,
    metadata: {},
  });

  revalidatePath("/admin/fan-headers");
  return { ok: true };
}
