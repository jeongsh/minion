import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "../supabase/admin.ts";
import type { MatchBriefingSnapshot } from "../match-briefing-data.ts";

/** 기존 AI 문구와 생성 시각을 보존하면서 수집 자료만 보충한다. */
export async function backfillMatchBriefingSnapshot(snapshot: MatchBriefingSnapshot, { replaceExisting = false } = {}) {
  const admin = createSupabaseAdminClient();
  const { data: cached, error } = await admin.from("match_ai_previews")
    .select("content,input_hash,generation_phase,generated_at").eq("match_id", snapshot.matchId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!cached || (cached.content?.briefingData && !replaceExisting)) return false;
  const lockToken = randomUUID();
  const { data: claimed, error: claimError } = await admin.rpc("claim_match_ai_preview_generation", {
    p_match_id: snapshot.matchId, p_lock_token: lockToken,
    p_input_hash: cached.input_hash, p_generation_phase: cached.generation_phase,
  });
  if (claimError) throw new Error(claimError.message);
  if (claimed !== true) return false;
  try {
    // 수집 중 새 프리뷰가 저장됐으면 그 내용을 덮어쓰지 않는다.
    const { data: saved, error: saveError } = await admin.from("match_ai_previews").update({
      content: { ...cached.content, briefingData: snapshot }, generation_lock_token: lockToken,
    }).eq("match_id", snapshot.matchId).eq("input_hash", cached.input_hash)
      .eq("generated_at", cached.generated_at).select("content,generation_lock_token").maybeSingle();
    if (saveError) throw new Error(saveError.message);
    return saved?.generation_lock_token === lockToken && saved?.content?.briefingData?.version === 1;
  } finally {
    const { error: releaseError } = await admin.from("match_ai_preview_generation_locks").delete()
      .eq("match_id", snapshot.matchId).eq("lock_token", lockToken);
    if (releaseError) throw new Error(`브리핑 자료 저장 lease 해제 실패: ${releaseError.message}`);
  }
}
