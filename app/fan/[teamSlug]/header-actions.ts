"use server";

import { revalidatePath } from "next/cache";

import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import { COMMUNITY_UPLOAD_BUCKET } from "@/lib/community/upload-security";
import {
  checkFanHeaderUploadEligibility,
  fanHeaderImageUrl,
  fanHeaderUploadBlockedMessage,
  kstWeekStart,
} from "@/lib/fan/fan-header";
import { sendDiscordFanHeaderRequestAlert } from "@/lib/notify/discord";
import { recordOperationalEvent } from "@/lib/observability/operational-events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CAPTION_MAX_LENGTH = 60;

type ActionResult = { ok: boolean; error?: string };

/**
 * /api/community/upload 로 이미 올라간 객체를 헤더 후보로 등록한다.
 * 업로드 자체(용량·매직바이트·쿼터)는 그 라우트가 검증하므로 여기서는 자격과 비율만 본다.
 */
export async function submitFanHeaderCandidate(input: {
  teamId: string;
  teamSlug: string;
  imagePath: string;
  width: number;
  height: number;
  caption?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  const eligibility = await checkFanHeaderUploadEligibility(input.teamId, user?.id);
  if (!eligibility.ok || !user) {
    return { ok: false, error: fanHeaderUploadBlockedMessage(eligibility.ok ? "anonymous" : eligibility.reason) };
  }

  // 규격은 막지 않는다. 요청자가 모달 프리뷰로 잘림을 직접 보고 판단하며,
  // 최종 판단은 어차피 운영진 검토에서 한다. 여기서는 저장 자체가 불가능한 값만 거른다.
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width < 1 || input.height < 1) {
    return { ok: false, error: "이미지 정보를 읽지 못했어요." };
  }

  const supabase = createSupabaseAdminClient();

  // 업로드한 사람 본인의 객체인지 확인한다. imagePath는 클라이언트가 보내므로 신뢰하지 않는다.
  // 커뮤니티 업로드 경로 규칙은 `{userId}/{YYYY-MM-DD}/{uuid}.{ext}` 이다.
  if (!input.imagePath.startsWith(`${user.id}/`)) {
    return { ok: false, error: "잘못된 이미지 경로예요." };
  }

  const caption = input.caption?.trim().slice(0, CAPTION_MAX_LENGTH) || null;

  const { data, error } = await supabase
    .from("fan_header_candidates")
    .insert({
      team_id: input.teamId,
      user_id: user.id,
      image_path: input.imagePath,
      width: input.width,
      height: input.height,
      caption,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await recordOperationalEvent(supabase, {
    eventType: "fan_header_request_created",
    actorUserId: user.id,
    targetType: "fan_header_candidate",
    targetId: data.id,
    metadata: { teamId: input.teamId, imagePath: input.imagePath },
  });

  await notifyFanHeaderRequest({
    teamId: input.teamId,
    teamSlug: input.teamSlug,
    requesterName: user.nickname ?? "익명 팬",
    imagePath: input.imagePath,
    width: input.width,
    height: input.height,
    caption,
  });

  revalidatePath("/admin/fan-headers");
  return { ok: true };
}

/** 요청 접수 알림. 웹훅이 없거나 실패해도 요청 자체는 성공으로 둔다. */
async function notifyFanHeaderRequest(input: {
  teamId: string;
  teamSlug: string;
  requesterName: string;
  imagePath: string;
  width: number;
  height: number;
  caption: string | null;
}) {
  const webhookUrl = process.env.DISCORD_COMMUNITY_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: team }, { count }] = await Promise.all([
      supabase.from("teams").select("short_name").eq("id", input.teamId).maybeSingle(),
      supabase
        .from("fan_header_candidates")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .is("deleted_at", null),
    ]);

    await sendDiscordFanHeaderRequestAlert(
      webhookUrl,
      {
        teamName: team?.short_name ?? input.teamSlug,
        teamSlug: input.teamSlug,
        requesterName: input.requesterName,
        imageUrl: fanHeaderImageUrl(input.imagePath),
        width: input.width,
        height: input.height,
        caption: input.caption,
        pendingCount: count ?? null,
      },
      process.env.NEXT_PUBLIC_SITE_URL,
    );
  } catch (error) {
    console.warn("[fan-header] discord alert failed", error);
  }
}

export async function toggleFanHeaderVote(
  candidateId: string,
  teamSlug: string,
): Promise<{ ok: boolean; voted?: boolean; voteCount?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("toggle_fan_header_vote", {
    p_candidate_id: candidateId,
    p_user_id: user.id,
  });

  if (error) return { ok: false, error: error.message };

  const row = data?.[0];
  revalidatePath(`/fan/${teamSlug}/header`);
  return { ok: true, voted: row?.voted, voteCount: row?.vote_count };
}

/**
 * 어드민이 후보를 이번 주 대표 헤더로 즉시 적용한다.
 * 주간 배치를 기다리지 않고 갈아끼우는 운영용 경로라, 같은 주에 여러 번 바꿔도 된다.
 */
export async function applyFanHeaderCandidate(candidateId: string, teamSlug: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !(await isCurrentUserAdmin())) return { ok: false, error: "권한이 없어요." };

  const supabase = createSupabaseAdminClient();
  const { data: candidate } = await supabase
    .from("fan_header_candidates")
    .select("id, team_id, vote_count, deleted_at, blinded_at")
    .eq("id", candidateId)
    .maybeSingle();

  if (!candidate || candidate.deleted_at || candidate.blinded_at) {
    return { ok: false, error: "적용할 수 없는 후보예요." };
  }

  const { error } = await supabase.from("fan_header_selections").upsert(
    {
      team_id: candidate.team_id,
      week_start: kstWeekStart(),
      candidate_id: candidate.id,
      vote_count: candidate.vote_count,
      selected_at: new Date().toISOString(),
    },
    { onConflict: "team_id,week_start" },
  );

  if (error) return { ok: false, error: error.message };

  await recordOperationalEvent(supabase, {
    eventType: "fan_header_applied",
    actorUserId: user.id,
    targetType: "fan_header_candidate",
    targetId: candidate.id,
    metadata: { teamId: candidate.team_id, weekStart: kstWeekStart() },
  });

  // 헤더는 팬페이지 전 화면 상단에 걸리므로 팀 홈까지 함께 무효화한다.
  revalidatePath(`/fan/${teamSlug}`);
  revalidatePath(`/fan/${teamSlug}/header`);
  return { ok: true };
}

/** 본인이 올린 후보만 내릴 수 있다. 소프트 삭제 후 스토리지 객체도 정리한다. */
export async function deleteFanHeaderCandidate(candidateId: string, teamSlug: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요해요." };

  const supabase = createSupabaseAdminClient();
  const { data: candidate } = await supabase
    .from("fan_header_candidates")
    .select("id, user_id, image_path, deleted_at")
    .eq("id", candidateId)
    .maybeSingle();

  if (!candidate || candidate.deleted_at) return { ok: false, error: "이미 삭제된 후보예요." };
  if (candidate.user_id !== user.id) return { ok: false, error: "본인이 올린 헤더만 삭제할 수 있어요." };

  const { error } = await supabase
    .from("fan_header_candidates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", candidateId);

  if (error) return { ok: false, error: error.message };

  await supabase.storage.from(COMMUNITY_UPLOAD_BUCKET).remove([candidate.image_path]);

  revalidatePath(`/fan/${teamSlug}/header`);
  return { ok: true };
}
