import "server-only";
import { unstable_cache } from "next/cache";
import type { StoredPreviewPrediction } from "../match-preview-accuracy.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

/** 저장된 프리뷰의 경기 전 승률. 매시간 생성 주기에 맞춰 1시간 캐시한다. */
export const getStoredPreviewPredictions = unstable_cache(async (): Promise<StoredPreviewPrediction[]> => {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("match_ai_previews").select("match_id,evidence,generated_at");
  if (error) throw new Error(`프리뷰 적중률 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => {
    const value = (row.evidence as { winProbabilityA?: unknown } | null)?.winProbabilityA;
    return {
      matchId: row.match_id as string,
      winProbabilityA: typeof value === "number" && Number.isFinite(value) ? value : null,
      generatedAt: row.generated_at as string,
    };
  });
}, ["match-preview-predictions-v1"], { revalidate: 3600 });
