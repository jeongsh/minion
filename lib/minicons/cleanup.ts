import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MINICON_UPLOAD_BUCKET } from "./upload-security";

const CLEANUP_BATCH_SIZE = 500;
const PRUNE_BATCH_SIZE = 1000;

type CleanupReceipt = {
  receipt_id: string;
  storage_path: string;
};

export type MiniconUploadCleanupSummary = {
  claimed: number;
  removed: number;
  pruned: number;
};

/**
 * 제출 가능 시간(48시간)이 지난 미사용 업로드를 Storage API로 지운다.
 * cleanup_pending 행은 DB에 남기므로 Storage 장애 시 다음 실행에서 재시도한다.
 */
export async function cleanupStaleMiniconUploads(): Promise<MiniconUploadCleanupSummary> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_stale_minicon_upload_cleanup", {
    p_limit: CLEANUP_BATCH_SIZE,
  });
  if (error) throw new Error(`Failed to claim stale minicon uploads: ${error.message}`);

  const receipts = (data ?? []) as CleanupReceipt[];
  let removed = 0;
  if (receipts.length > 0) {
    const { error: removeError } = await admin.storage
      .from(MINICON_UPLOAD_BUCKET)
      .remove(receipts.map((receipt) => receipt.storage_path));
    if (removeError) throw new Error(`Failed to remove stale minicon uploads: ${removeError.message}`);

    const { data: completed, error: completionError } = await admin.rpc(
      "complete_stale_minicon_upload_cleanup",
      { p_receipt_ids: receipts.map((receipt) => receipt.receipt_id) },
    );
    if (completionError) {
      throw new Error(`Failed to complete stale minicon cleanup: ${completionError.message}`);
    }
    removed = Number(completed ?? 0);
  }

  const { data: pruned, error: pruneError } = await admin.rpc(
    "prune_cleaned_minicon_upload_receipts",
    { p_limit: PRUNE_BATCH_SIZE },
  );
  if (pruneError) throw new Error(`Failed to prune minicon upload receipts: ${pruneError.message}`);

  return {
    claimed: receipts.length,
    removed,
    pruned: Number(pruned ?? 0),
  };
}
