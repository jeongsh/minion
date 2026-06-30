// 공유 seam: 랭크(LP) 트랙이 구현, 게시판 트랙이 호출한다.
// LP 원장 기록 + profiles.lp 갱신(MIN_LP 미만 clamp) + 기본 티어 재계산.
// 챌린저 50명 cap은 읽기 시 ranked_profiles 뷰에서 동적 계산하므로 여기선 base tier만 갱신.
// 게시판 트랙은 이 시그니처에만 의존하므로 export 형태/타입은 유지한다.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LP_DELTAS, MIN_LP, baseTierForLp } from "@/lib/rank/config";

export type LpReason =
  | "attendance" // 출첵
  | "post_created" // 글 작성
  | "comment_created" // 댓글 작성
  | "honor_received" // 명예(좋아요) 받음 +
  | "honor_removed" // 명예 취소 -
  | "dishonor_received" // 디스(싫어요) 받음 -
  | "reported"; // 리폿 누적 제재 -

export type RecordLpInput = {
  userId: string;
  reason: LpReason;
  postId?: string;
  commentId?: string;
};

export async function recordLpEvent(input: RecordLpInput): Promise<void> {
  const { userId, reason, postId, commentId } = input;

  if (!userId) return;

  const delta = LP_DELTAS[reason];
  if (delta === undefined) return;

  // 서비스 롤로 안전하게 기록(호출 측 RLS 컨텍스트에 의존하지 않음).
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    // 서비스 롤 키 미설정 등 → 조용히 무시(멱등/안전).
    return;
  }

  // 대상 프로필 조회. 없으면 무시.
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, lp")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return;
  }

  const nextLp = Math.max(MIN_LP, profile.lp + delta);
  const nextTier = baseTierForLp(nextLp);

  // 원장 기록.
  await admin.from("lp_ledger").insert({
    user_id: userId,
    reason,
    delta,
    post_id: postId ?? null,
    comment_id: commentId ?? null,
  });

  // 프로필 LP/티어 갱신.
  await admin
    .from("profiles")
    .update({ lp: nextLp, tier: nextTier })
    .eq("id", userId);
}
