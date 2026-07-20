/**
 * Leaguepedia 타임라인(킬/오브젝트/건물파괴 이벤트 + 분당 골드/경험치/CS 프레임)을
 * timeline_events / match_timeline_frames 테이블에 채우는 백필 스크립트.
 *
 * 실제 파싱/저장 로직은 크론 자동화(lib/lolesports-rating-automation.ts)와 동일한
 * lib/sync/leaguepedia-timeline.ts의 syncLeaguepediaTimelineForSet을 그대로 재사용한다.
 *
 * 실행:
 *   npx tsx scripts/backfill-timeline-events.ts [--force] [--match <matchId>] [--set <setId>] [--segment=<segment>]
 *
 * --force: 이미 골드 프레임이 채워진 세트도 다시 가져와서 덮어씀
 * --match: 특정 매치 ID만 처리
 * --set: 특정 세트 ID만 처리
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { syncLeaguepediaTimelineForSet } from "../lib/sync/leaguepedia-timeline.ts";

// ─── 환경 변수 ─────────────────────────────────────────────────

function loadEnvFile() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=");
    }
  } catch { /* 이미 설정된 경우 무시 */ }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseSegmentArg() {
  const arg = process.argv.find((a) => a.startsWith("--segment="));
  return arg ? arg.split("=")[1]?.trim() || null : null;
}

async function tournamentIdsForSegment(
  supabase: SupabaseClient,
  segment: string,
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from("tournaments").select("id");
  switch (segment) {
    case "lck":           q = q.eq("league", "LCK"); break;
    case "lck-cup":       q = q.eq("league", "LCK").eq("split", "Cup"); break;
    case "first-stand":   q = q.eq("league", "First Stand"); break;
    case "msi":           q = q.eq("league", "MSI"); break;
    case "ewc":           q = q.eq("league", "EWC"); break;
    case "worlds":        q = q.eq("league", "Worlds"); break;
    case "enc":           q = q.eq("league", "ENC"); break;
    case "kespa-cup":     q = q.eq("league", "KeSPA Cup"); break;
    case "international": q = q.eq("category", "international"); break;
    default:
      console.warn(`알 수 없는 세그먼트: ${segment}, 전체 처리`);
      return [];
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((t: { id: string }) => t.id);
}

type SetRow = { id: string };

const REQUEST_DELAY_MS = 3000;
const MAX_RATE_LIMIT_RETRIES = 6;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── 메인 ──────────────────────────────────────────────────────

async function main() {
  loadEnvFile();
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const matchIdx = args.indexOf("--match");
  const matchId = matchIdx !== -1 ? args[matchIdx + 1] : null;
  const setIdx = args.indexOf("--set");
  const setId = setIdx !== -1 ? args[setIdx + 1] : null;

  const segment = parseSegmentArg();
  let segMatchIds: string[] | null = null;
  if (segment) {
    const tIds = await tournamentIdsForSegment(supabase, segment);
    if (tIds.length === 0) {
      console.log(`세그먼트 '${segment}'에 해당하는 토너먼트가 없습니다.`);
      return;
    }
    const { data: mData } = await supabase.from("matches").select("id").in("tournament_id", tIds);
    segMatchIds = (mData ?? []).map((m: { id: string }) => m.id);
    console.log(`리그 필터: ${segment} (매치 ${segMatchIds.length}개)`);
  }

  // 1. 처리할 세트 목록 조회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let setsQuery: any = supabase
    .from("sets")
    .select("id")
    .not("leaguepedia_game_id", "is", null);

  if (matchId) setsQuery = setsQuery.eq("match_id", matchId);
  if (setId) setsQuery = setsQuery.eq("id", setId);
  if (segMatchIds) setsQuery = setsQuery.in("match_id", segMatchIds);

  const { data: sets, error: setsError } = await setsQuery;
  if (setsError || !sets) throw new Error(`세트 조회 실패: ${setsError?.message}`);

  // 골드 프레임까지 이미 채워진 세트는 제외 (--force 아닐 경우)
  let targetSets: SetRow[] = sets as SetRow[];
  if (!force) {
    const { data: existingFrameSetIds } = await supabase
      .from("match_timeline_frames")
      .select("set_id")
      .in("set_id", (sets as SetRow[]).map((s) => s.id));
    const done = new Set((existingFrameSetIds ?? []).map((r: { set_id: string }) => r.set_id));
    targetSets = targetSets.filter((s) => !done.has(s.id));
  }

  console.log(`처리할 세트: ${targetSets.length}개 (전체 ${sets.length}개)`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < targetSets.length; i++) {
    const set = targetSets[i];
    process.stdout.write(`[${i + 1}/${targetSets.length}] ${set.id} ... `);

    if (force) {
      await supabase.from("timeline_events").delete().eq("set_id", set.id);
      await supabase.from("match_timeline_frames").delete().eq("set_id", set.id);
    }

    try {
      let result = await syncLeaguepediaTimelineForSet(supabase, set.id);
      for (let attempt = 0; result.status === "rate_limited" && attempt < MAX_RATE_LIMIT_RETRIES; attempt++) {
        await sleep(REQUEST_DELAY_MS * (attempt + 2));
        result = await syncLeaguepediaTimelineForSet(supabase, set.id);
      }

      if (result.status === "succeeded") {
        console.log(
          `완료 (이벤트 ${result.inserted}개${result.skipped ? `, 중복 ${result.skipped}개 skip` : ""}, 골드 프레임 ${result.framesInserted}개)`,
        );
        processed++;
      } else if (result.status === "rate_limited") {
        console.log("레이트리밋 초과 — 스킵");
        failed++;
      } else {
        console.log(`스킵 — ${result.reason ?? "소스 데이터 없음"}`);
      }
    } catch (err) {
      console.log(`오류: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\n완료: ${processed}개 성공, ${failed}개 실패`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
