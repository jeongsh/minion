import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { COMMUNITY_UPLOAD_BUCKET } from "@/lib/community/upload-security";
import {
  FAN_HEADER_FOLLOW_DAYS,
  FAN_HEADER_MAX_CANDIDATES_PER_USER,
  type FanHeaderState,
  type FanHeaderUploadBlockedReason,
} from "@/lib/fan/fan-header-constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { kstWeekStart } from "@/lib/sync/fan-header-selection";

export { kstWeekStart };
export * from "@/lib/fan/fan-header-constants";

export function fanHeaderImageUrl(imagePath: string): string {
  const {
    data: { publicUrl },
  } = createSupabaseAdminClient().storage.from(COMMUNITY_UPLOAD_BUCKET).getPublicUrl(imagePath);
  return publicUrl;
}

/**
 * 업로드 자격 판정. 로그인 + 해당 팀 FAN_HEADER_FOLLOW_DAYS일 이상 팔로우.
 * 팔로우가 계정에 귀속되기 전(레거시 쿠키 행)에는 기간을 알 수 없으므로 자격 없음으로 본다.
 * 어드민은 팔로우 여부·기간·개수 제한을 모두 건너뛴다(운영상 시안을 바로 올려야 한다).
 */
export async function checkFanHeaderUploadEligibility(
  teamId: string,
  userId: string | undefined,
): Promise<{ ok: true } | { ok: false; reason: FanHeaderUploadBlockedReason }> {
  if (!userId) return { ok: false, reason: "anonymous" };
  if (await isCurrentUserAdmin()) return { ok: true };

  const supabase = createSupabaseAdminClient();
  const { data: follow } = await supabase
    .from("team_fans")
    .select("created_at")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!follow) return { ok: false, reason: "not-following" };

  const followedMs = Date.now() - new Date(follow.created_at).getTime();
  if (followedMs < FAN_HEADER_FOLLOW_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, reason: "too-new" };
  }

  const { count } = await supabase
    .from("fan_header_candidates")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if ((count ?? 0) >= FAN_HEADER_MAX_CANDIDATES_PER_USER) return { ok: false, reason: "quota" };

  return { ok: true };
}

/** 이번 주 대표 헤더 이미지 URL. 선정 레코드가 없으면 null. */
export async function getActiveFanHeaderUrl(teamId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("fan_header_selections")
    .select("candidate_id, fan_header_candidates(image_path, deleted_at, blinded_at)")
    .eq("team_id", teamId)
    .eq("week_start", kstWeekStart())
    .maybeSingle();

  // PostgREST는 관계를 객체로도 배열로도 돌려줄 수 있어 양쪽을 받는다.
  type CandidateRow = { image_path: string; deleted_at: string | null; blinded_at: string | null };
  const joined = data?.fan_header_candidates as CandidateRow | CandidateRow[] | null | undefined;
  const candidate = Array.isArray(joined) ? joined[0] : joined;

  // 선정 후 삭제·블라인드된 이미지는 즉시 내린다.
  if (!candidate || candidate.deleted_at || candidate.blinded_at) return null;
  return fanHeaderImageUrl(candidate.image_path);
}

export async function getFanHeaderState(teamId: string, userId: string | undefined): Promise<FanHeaderState> {
  const supabase = createSupabaseAdminClient();

  const [activeImageUrl, eligibility, isAdmin, selection, candidateRows] = await Promise.all([
    getActiveFanHeaderUrl(teamId),
    checkFanHeaderUploadEligibility(teamId, userId),
    isCurrentUserAdmin(),
    supabase
      .from("fan_header_selections")
      .select("candidate_id")
      .eq("team_id", teamId)
      .eq("week_start", kstWeekStart())
      .maybeSingle(),
    supabase
      .from("fan_header_candidates")
      .select("id, team_id, user_id, image_path, width, height, caption, vote_count, created_at")
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .is("blinded_at", null)
      .order("vote_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const rows = candidateRows.data ?? [];

  // 작성자 닉네임. user_id가 auth.users를 참조하므로 profiles 조인이 PostgREST에서 풀리지 않는다.
  // 별도 조회 후 메모리에서 붙인다.
  const nicknames = new Map<string, string | null>();
  if (rows.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", [...new Set(rows.map((row) => row.user_id))]);
    for (const profile of profiles ?? []) nicknames.set(profile.id, profile.nickname);
  }

  // 내가 투표한 후보를 한 번에 조회한다(행마다 조회하지 않는다).
  let myVotes = new Set<string>();
  if (userId && rows.length) {
    const { data: votes } = await supabase
      .from("fan_header_votes")
      .select("candidate_id")
      .eq("user_id", userId)
      .in(
        "candidate_id",
        rows.map((row) => row.id),
      );
    myVotes = new Set((votes ?? []).map((vote) => vote.candidate_id));
  }

  const activeCandidateId = selection.data?.candidate_id ?? null;

  return {
    activeImageUrl,
    weekStart: kstWeekStart(),
    isAdmin,
    canUpload: eligibility.ok,
    uploadBlockedReason: eligibility.ok ? null : eligibility.reason,
    candidates: rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      userId: row.user_id,
      imageUrl: fanHeaderImageUrl(row.image_path),
      width: row.width,
      height: row.height,
      caption: row.caption,
      voteCount: row.vote_count,
      createdAt: row.created_at,
      authorNickname: nicknames.get(row.user_id) ?? null,
      votedByMe: myVotes.has(row.id),
      isActive: row.id === activeCandidateId,
    })),
  };
}
