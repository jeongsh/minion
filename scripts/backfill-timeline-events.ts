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

// Supabase의 .in()은 URL 쿼리스트링에 id를 그대로 나열하는데, 수백~천 개를 한 번에
// 넣으면 URL 길이 제한에 걸려 조용히 실패하거나 빈 결과가 온다(에러를 안 챙기면
// "아무것도 없음"처럼 보여서 필터가 있으나 마나 해진다) — 그래서 청크로 나눠 호출하고
// 매 청크마다 에러를 확인한다. match_timeline_frames/set_player_stats는 세트 1개당
// 행이 여러 개(프레임 수십 개, 선수 10명)라서, 청크 하나(id 200개)만으로도 결과 행이
// PostgREST 기본 최대 1000행을 넘어 잘릴 수 있다 — 그래서 청크 안에서도 페이지네이션한다
// (실제로 이미 채워진 세트가 "여전히 없다"고 잘못 판정되던 원인이었다).
async function fetchSetIdsChunked(
  supabase: SupabaseClient,
  table: string,
  column: string,
  setIds: string[],
  chunkSize = 200,
): Promise<string[]> {
  const result: string[] = [];
  const PAGE_SIZE = 1000;
  for (let i = 0; i < setIds.length; i += chunkSize) {
    const chunk = setIds.slice(i, i + chunkSize);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select(column)
        .in(column, chunk)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
      const rows = (data ?? []) as unknown as Array<Record<string, string>>;
      for (const row of rows) {
        result.push(row[column]);
      }
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return result;
}

async function fetchPlayerBuildCoverage(
  supabase: SupabaseClient,
  setIds: string[],
  chunkSize = 100,
) {
  const itemPlayerIdsBySet = new Map<string, Set<string>>();
  const skillPlayerIdsBySet = new Map<string, Set<string>>();
  const PAGE_SIZE = 1000;

  for (let i = 0; i < setIds.length; i += chunkSize) {
    const chunk = setIds.slice(i, i + chunkSize);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("timeline_events")
        .select("set_id, player_id, event_type")
        .in("set_id", chunk)
        .in("event_type", ["ITEM_PURCHASED", "SKILL_LEVEL_UP"])
        .not("player_id", "is", null)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(`선수 빌드 이벤트 조회 실패: ${error.message}`);

      const rows = (data ?? []) as Array<{ set_id: string; player_id: string; event_type: string }>;
      for (const row of rows) {
        const coverage = row.event_type === "ITEM_PURCHASED" ? itemPlayerIdsBySet : skillPlayerIdsBySet;
        const playerIds = coverage.get(row.set_id) ?? new Set<string>();
        playerIds.add(row.player_id);
        coverage.set(row.set_id, playerIds);
      }
      if (rows.length < PAGE_SIZE) break;
    }
  }

  return { itemPlayerIdsBySet, skillPlayerIdsBySet };
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

  // 1. 처리할 세트 목록 조회 (PostgREST 기본 최대 1000행 제한을 넘길 수 있어 페이지네이션한다).
  // 세그먼트 필터는 쿼리의 .in("match_id", ...)으로 걸지 않는다 — 매치가 수백 개면
  // URL에 id가 그대로 다 나열되면서 길이 제한에 걸려 "fetch failed"로 죽는다
  // (--segment=lck에서 실제로 겪은 문제). 대신 전체를 받아온 뒤 메모리에서 걸러낸다.
  const rawSets: Array<{ id: string; match_id: string }> = [];
  const PAGE_SIZE = 1000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let setsQuery: any = supabase
      .from("sets")
      .select("id, match_id")
      .not("leaguepedia_game_id", "is", null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (matchId) setsQuery = setsQuery.eq("match_id", matchId);
    if (setId) setsQuery = setsQuery.eq("id", setId);

    const { data: page, error: setsError } = await setsQuery;
    if (setsError) throw new Error(`세트 조회 실패: ${setsError.message}`);
    rawSets.push(...((page ?? []) as Array<{ id: string; match_id: string }>));
    if (!page || page.length < PAGE_SIZE) break;
  }

  const segMatchIdSet = segMatchIds ? new Set(segMatchIds) : null;
  const sets: SetRow[] = (
    segMatchIdSet ? rawSets.filter((s) => segMatchIdSet.has(s.match_id)) : rawSets
  ).map((s) => ({ id: s.id }));

  // 골드 프레임과 10명 전원의 아이템/스킬 이벤트까지 채워진 세트만 제외한다.
  // 과거에는 프레임만 확인해서, 선수 빌드 이벤트 파싱이 추가되기 전에 동기화된 세트를
  // 영구적으로 건너뛰는 문제가 있었다.
  let targetSets: SetRow[] = sets as SetRow[];
  let missingBuildEventTypesBySet = new Map<string, string[]>();
  let frameDone = new Set<string>();
  if (!force) {
    const existingFrameSetIds = await fetchSetIdsChunked(supabase, "match_timeline_frames", "set_id", targetSets.map((s) => s.id));
    frameDone = new Set(existingFrameSetIds);

    // 선수 스탯 10명이 다 안 채워진 세트는 syncLeaguepediaTimelineForSet이 항상
    // "Player mapping is incomplete"로 스킵한다 — 선수 스탯이 나중에 채워지기 전까지는
    // 재시도해봐야 매번 똑같이 실패하므로, 매 실행마다 로그만 낭비하지 않게 미리 뺀다
    // (--force일 땐 원래도 강제로 다 돌리니 그대로 둔다).
    const statSetIds = await fetchSetIdsChunked(supabase, "set_player_stats", "set_id", targetSets.map((s) => s.id));
    const statCountBySet = new Map<string, number>();
    for (const sid of statSetIds) {
      statCountBySet.set(sid, (statCountBySet.get(sid) ?? 0) + 1);
    }
    const notReady = targetSets.filter((s) => (statCountBySet.get(s.id) ?? 0) < 10).length;
    targetSets = targetSets.filter((s) => (statCountBySet.get(s.id) ?? 0) >= 10);
    if (notReady > 0) {
      console.log(`선수 스탯이 아직 안 채워져 스킵: ${notReady}개 (세트/세트 ID 동기화가 먼저 끝나야 함)`);
    }

    const coverage = await fetchPlayerBuildCoverage(supabase, targetSets.map((s) => s.id));
    missingBuildEventTypesBySet = new Map(
      targetSets.map((set) => {
        const missing: string[] = [];
        if ((coverage.itemPlayerIdsBySet.get(set.id)?.size ?? 0) < 10) {
          missing.push("ITEM_PURCHASED", "ITEM_SOLD", "ITEM_UNDO");
        }
        if ((coverage.skillPlayerIdsBySet.get(set.id)?.size ?? 0) < 10) {
          missing.push("SKILL_LEVEL_UP");
        }
        return [set.id, missing];
      }),
    );
    targetSets = targetSets.filter((set) => {
      const buildComplete = (missingBuildEventTypesBySet.get(set.id)?.length ?? 0) === 0;
      return !frameDone.has(set.id) || !buildComplete;
    });
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
      const missingBuildEventTypes = missingBuildEventTypesBySet.get(set.id) ?? [];
      const buildOnly = !force && frameDone.has(set.id) && missingBuildEventTypes.length > 0;
      let result = await syncLeaguepediaTimelineForSet(
        supabase,
        set.id,
        buildOnly
          ? { eventTypes: missingBuildEventTypes, skipFrames: true }
          : undefined,
      );
      for (let attempt = 0; result.status === "rate_limited" && attempt < MAX_RATE_LIMIT_RETRIES; attempt++) {
        await sleep(REQUEST_DELAY_MS * (attempt + 2));
        result = await syncLeaguepediaTimelineForSet(
          supabase,
          set.id,
          buildOnly
            ? { eventTypes: missingBuildEventTypes, skipFrames: true }
            : undefined,
        );
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
