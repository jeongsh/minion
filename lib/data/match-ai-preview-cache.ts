import "server-only";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

export type MatchAiPreviewCacheRow = {
  input_hash?: string;
  summary: string;
  watch_point: string;
  evidence: unknown;
  content?: unknown;
  generated_at?: string;
  generation_phase?: string;
  generation_lock_token?: string | null;
};

/** 요청 안에서 브리핑 복원과 AI 본문이 같은 저장본을 공유한다. */
export async function getStoredMatchAiPreview(matchId: string): Promise<MatchAiPreviewCacheRow | null> {
  const { data, error } = await createSupabaseAdminClient().from("match_ai_previews")
    .select("summary,watch_point,evidence,content,generated_at,generation_phase")
    .eq("match_id", matchId).maybeSingle();
  if (error) throw new Error(`매치 브리핑 기록 조회 실패: ${error.message}`);
  return data as MatchAiPreviewCacheRow | null;
}
