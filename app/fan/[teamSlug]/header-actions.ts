"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/current-user";
import { COMMUNITY_UPLOAD_BUCKET } from "@/lib/community/upload-security";
import {
  FAN_HEADER_MIN_ASPECT,
  FAN_HEADER_MIN_WIDTH,
  checkFanHeaderUploadEligibility,
  fanHeaderUploadBlockedMessage,
} from "@/lib/fan/fan-header";
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

  if (input.width < FAN_HEADER_MIN_WIDTH) {
    return { ok: false, error: `헤더 이미지는 가로 ${FAN_HEADER_MIN_WIDTH}px 이상이어야 해요.` };
  }
  if (input.width / input.height < FAN_HEADER_MIN_ASPECT) {
    return { ok: false, error: "헤더는 가로로 긴 이미지만 등록할 수 있어요. (가로:세로 16:10 이상)" };
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
    eventType: "fan_header_candidate_created",
    actorUserId: user.id,
    targetType: "fan_header_candidate",
    targetId: data.id,
    metadata: { teamId: input.teamId, imagePath: input.imagePath },
  });

  revalidatePath(`/fan/${input.teamSlug}/header`);
  return { ok: true };
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
