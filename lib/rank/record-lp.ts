// 공유 seam: 랭크(LP) 트랙이 구현, 게시판 트랙이 호출한다.
// LP 원장 기록 + profiles.lp 갱신(MIN_LP 미만 clamp) + 기본 티어 재계산을
// record_lp_event(uuid,text,integer,uuid,uuid) SQL 함수 한 번의 호출로 위임한다.
// 트랜잭션 원자성 + `lp + delta` 원자 갱신으로 부분 실패·동시 이벤트 delta 손실을 막는다.
// 챌린저 50명 cap은 읽기 시 ranked_profiles 뷰에서 동적 계산하므로 여기선 base tier만 갱신.
// 게시판 트랙은 이 시그니처에만 의존하므로 export 형태/타입은 유지한다.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LP_DELTAS } from "@/lib/rank/config";

export type LpReason =
  | "attendance" // 출첵
  | "post_created" // 글 작성
  | "comment_created" // 댓글 작성
  | "honor_received" // 명예(좋아요) 받음 +
  | "honor_removed" // 명예 취소 -
  | "dishonor_received" // 디스(싫어요) 받음 -
  | "dishonor_removed" // 디스(싫어요) 취소 +
  | "reported" // 리폿 누적 제재 -
  // 아래 4개는 승부예측 SQL 함수(place/cancel/settle_prediction_bet*)에서 직접 lp_ledger에 기록한다.
  // recordLpEvent()의 LP_DELTAS 고정값 방식이 아니라 베팅 금액만큼 가변 delta로 기록되므로 LP_DELTAS에는 없다.
  | "prediction_bet_placed"
  | "prediction_bet_cancelled"
  | "prediction_bet_won"
  | "prediction_bet_refunded";

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

  // 원장 insert + profiles.lp/tier 갱신을 SQL 함수 한 번(단일 트랜잭션)으로 처리한다.
  // 프로필이 없으면 함수가 조용히 무시한다(기존 동작 유지).
  const { error } = await admin.rpc("record_lp_event", {
    p_user_id: userId,
    p_reason: reason,
    p_delta: delta,
    p_post_id: postId ?? null,
    p_comment_id: commentId ?? null,
  });

  // 호출부(글/댓글/좋아요 등)의 주 작업은 이미 성공한 상태라 여기서 throw 하지 않는다.
  // 다만 조용히 삼키면 LP 누락을 추적할 수 없으므로 로그는 남긴다.
  if (error) {
    console.error("recordLpEvent failed", { userId, reason, error });
  }
}
