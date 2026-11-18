import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { transferSeason, type TransferMarket } from "./types";

export const TRANSFER_MARKET_TAG = "lck-transfer-market";

export async function getTransferMarket(season = transferSeason()): Promise<TransferMarket | null> {
  const { data, error } = await createSupabaseServerClient().from("lck_transfer_markets").select("*").eq("season", season).maybeSingle();
  if (error) throw new Error("이적시장을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  return data as TransferMarket | null;
}

export const getCachedTransferMarket = unstable_cache(
  getTransferMarket,
  [TRANSFER_MARKET_TAG],
  { revalidate: 30, tags: [TRANSFER_MARKET_TAG] },
);
