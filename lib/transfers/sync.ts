import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseNamuTransferDocument } from "./namuwiki.ts";
import { namuTransferUrl, transferSeason, type TransferMarket } from "./types.ts";

const MAX_DOCUMENT_BYTES = 2_000_000;

async function readDocument(season: number) {
  const response = await fetch(namuTransferUrl(season), {
    headers: { "User-Agent": "MINION-TransferSync/1.0 (+https://minion.fan)", Accept: "text/html" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
    throw new Error(`나무위키 문서를 가져오지 못했습니다 (${response.status}). 잠시 후 다시 시도해 주세요. 기존 데이터는 유지됩니다.`);
  }
  if (!response.body) throw new Error("나무위키 응답이 비어 있습니다.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_DOCUMENT_BYTES) throw new Error("나무위키 문서가 허용 크기를 초과했습니다. 기존 데이터를 유지합니다.");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks).toString("utf8");
}

export async function syncTransferMarket(client: SupabaseClient, options: { season?: number; scheduled?: boolean } = {}) {
  const season = options.season ?? transferSeason();
  if (!Number.isInteger(season) || season < 2026 || season > transferSeason()) throw new Error("지원하지 않는 스토브리그 연도입니다.");
  const checkedAt = new Date().toISOString();
  const { data, error } = await client.from("lck_transfer_markets").select("*").eq("season", season).maybeSingle();
  if (error) throw new Error(`이적시장 저장소를 읽지 못했습니다 (${error.code}).`);
  const previous = data as TransferMarket | null;
  if (options.scheduled && previous?.auto_sync === false) return { changed: false, skipped: true, events: previous.snapshot.events.length, season };
  if (previous && Date.now() - Date.parse(previous.checked_at) < 60_000) return { changed: false, skipped: true, events: previous.snapshot.events.length, season };
  const snapshot = parseNamuTransferDocument(await readDocument(season), season);
  // Hash semantic facts only, not ads, DOM class names or unrelated prose revisions.
  const contentHash = createHash("sha256").update(JSON.stringify({ ...snapshot, sourceUpdatedAt: null })).digest("hex");
  const changed = previous?.content_hash !== contentHash;
  const values = { season, snapshot, content_hash: contentHash, checked_at: checkedAt, synced_at: changed ? checkedAt : previous!.synced_at };
  if (previous) {
    if (previous.snapshot.sourceUpdatedAt && snapshot.sourceUpdatedAt && snapshot.sourceUpdatedAt < previous.snapshot.sourceUpdatedAt) throw new Error("이전 문서 버전이 반환되어 동기화하지 않았습니다.");
    // A stale concurrent request must not overwrite a newer sync. Manual events are untouched.
    let query = client.from("lck_transfer_markets").update(values).eq("season", season).eq("checked_at", previous.checked_at);
    if (options.scheduled) query = query.eq("auto_sync", true);
    const { data: updated, error: updateError } = await query.select("season");
    if (updateError) throw new Error(`이적시장 저장에 실패했습니다 (${updateError.code}).`);
    if (!updated.length) return { changed: false, skipped: true, events: previous.snapshot.events.length, season };
  } else {
    const { error: insertError } = await client.from("lck_transfer_markets").insert(values);
    if (insertError?.code === "23505") return { changed: false, skipped: true, events: snapshot.events.length, season };
    if (insertError) throw new Error(`이적시장 저장에 실패했습니다 (${insertError.code}).`);
  }
  return { changed, skipped: false, events: snapshot.events.length, season };
}
