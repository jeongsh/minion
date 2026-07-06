/**
 * Leaguepedia PostgameJsonMetadata에서 타임라인 JSON을 가져와
 * match_timeline_frames(분당 골드/경험치/CS) 테이블을 채우는 백필 스크립트.
 * 이미 timeline_events가 있는 세트만 대상으로 하며, 이벤트 자체는 건드리지 않는다.
 *
 * 실행:
 *   npx tsx scripts/backfill-timeline-frames.ts [--force] [--match <matchId>] [--set <setId>] [--segment=<segment>]
 *
 * --force: 이미 프레임이 있는 세트도 다시 채움(덮어씀)
 * --match: 특정 매치 ID만 처리
 * --set: 특정 세트 ID만 처리
 * --segment=: 리그 필터 (lck, lck-cup, first-stand, msi, ewc, worlds, enc, international)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
    case "international": q = q.eq("category", "international"); break;
    default:
      console.warn(`알 수 없는 세그먼트: ${segment}, 전체 처리`);
      return [];
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((t: { id: string }) => t.id);
}

// ─── 타입 ──────────────────────────────────────────────────────

type SetRow = {
  id: string;
  leaguepedia_game_id: string | null;
  riot_platform_game_id: string | null;
  blue_team_id: string;
  red_team_id: string;
};

type PlayerStatRow = {
  set_id: string;
  player_id: string;
  team_id: string;
  position: string;
};

type RiotParticipantFrame = {
  totalGold?: number;
  xp?: number;
  minionsKilled?: number;
  jungleMinionsKilled?: number;
};

type RiotFrame = {
  timestamp: number;
  participantFrames?: Record<string, RiotParticipantFrame>;
};

type RiotTimeline = {
  frames: RiotFrame[];
};

// ─── Leaguepedia API ────────────────────────────────────────────

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 6;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Supabase 호출의 일시적 fetch 실패(네트워크 블립)를 짧게 재시도한다. */
async function withSupabaseRetry<T>(
  fn: () => PromiseLike<{ data: T; error: { message: string } | null }>,
  retries = 3,
): Promise<{ data: T; error: { message: string } | null }> {
  let last: { data: T; error: { message: string } | null } | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await fn();
    if (!last.error || !/fetch failed/i.test(last.error.message)) return last;
    await sleep(1500 * (attempt + 1));
  }
  return last!;
}

function isRateLimited(body: { error?: { code?: string } } | null | undefined) {
  return body?.error?.code === "ratelimited";
}

async function cargoQuery(params: Record<string, string>): Promise<Record<string, string>[]> {
  const urlParams = new URLSearchParams({ action: "cargoquery", format: "json", limit: "500" });
  for (const [k, v] of Object.entries(params)) urlParams.set(k, v);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(`${CARGO_API}?${urlParams}`, {
      headers: { "user-agent": "LCKHubMinion/0.1 (backfill-timeline-frames)" },
    });
    if (!res.ok && (res.status === 429 || res.status >= 500)) {
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }
    if (!res.ok) throw new Error(`Cargo 요청 실패: ${res.status}`);
    const body = (await res.json()) as {
      cargoquery?: Array<{ title: Record<string, string> }>;
      error?: { code?: string };
    };
    if (isRateLimited(body)) {
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }
    return (body.cargoquery ?? []).map((row) => row.title);
  }
  throw new Error("Cargo 요청 최대 재시도 초과");
}

async function fetchWikiPage(title: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "revisions",
    rvprop: "content",
    format: "json",
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(`${CARGO_API}?${params}`, {
      headers: { "user-agent": "LCKHubMinion/0.1 (backfill-timeline-frames)" },
    });
    if (!res.ok && (res.status === 429 || res.status >= 500)) {
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }
    if (!res.ok) throw new Error(`Wiki 페이지 요청 실패: ${res.status}`);
    const body = (await res.json()) as {
      query?: { pages?: Record<string, { revisions?: Array<{ "*": string }> }> };
      error?: { code?: string };
    };
    if (isRateLimited(body)) {
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }
    const pages = body.query?.pages ?? {};
    const page = Object.values(pages)[0];
    if (!page || !page.revisions?.length) return null;
    return page.revisions[0]["*"];
  }
  throw new Error("Wiki 페이지 최대 재시도 초과");
}

// ─── 파싱 헬퍼 ─────────────────────────────────────────────────

const POSITION_ORDER = ["TOP", "JGL", "MID", "BOT", "SUP"];

function buildParticipantMap(
  stats: PlayerStatRow[],
  blueTeamId: string,
  redTeamId: string,
): Map<number, { playerId: string; teamId: string }> {
  const map = new Map<number, { playerId: string; teamId: string }>();

  const bluePlayers = stats
    .filter((s) => s.team_id === blueTeamId)
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));
  const redPlayers = stats
    .filter((s) => s.team_id === redTeamId)
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));

  bluePlayers.forEach((p, i) => map.set(i + 1, { playerId: p.player_id, teamId: blueTeamId }));
  redPlayers.forEach((p, i) => map.set(i + 6, { playerId: p.player_id, teamId: redTeamId }));

  return map;
}

function parseTimelineFrames(
  timeline: RiotTimeline,
  setId: string,
  blueTeamId: string,
  redTeamId: string,
  participantMap: Map<number, { playerId: string; teamId: string }>,
) {
  const byMinute = new Map<number, {
    set_id: string;
    minute: number;
    timestamp_ms: number;
    blue_total_gold: number;
    red_total_gold: number;
    gold_diff: number;
    blue_total_xp: number;
    red_total_xp: number;
    xp_diff: number;
    blue_total_cs: number;
    red_total_cs: number;
    cs_diff: number;
  }>();

  for (const frame of timeline.frames) {
    const participantFrames = frame.participantFrames ?? {};
    let blueGold = 0, redGold = 0, blueXp = 0, redXp = 0, blueCs = 0, redCs = 0;
    let hasBlue = false, hasRed = false;

    for (const [participantId, pf] of Object.entries(participantFrames)) {
      const participant = participantMap.get(Number(participantId));
      if (!participant) continue;
      const isBlue = participant.teamId === blueTeamId;
      const isRed = participant.teamId === redTeamId;
      if (!isBlue && !isRed) continue;

      const gold = typeof pf.totalGold === "number" ? pf.totalGold : 0;
      const xp = typeof pf.xp === "number" ? pf.xp : 0;
      const cs = (typeof pf.minionsKilled === "number" ? pf.minionsKilled : 0)
        + (typeof pf.jungleMinionsKilled === "number" ? pf.jungleMinionsKilled : 0);

      if (isBlue) { blueGold += gold; blueXp += xp; blueCs += cs; hasBlue = true; }
      else { redGold += gold; redXp += xp; redCs += cs; hasRed = true; }
    }

    if (!hasBlue || !hasRed) continue;

    const minute = Math.floor(frame.timestamp / 60_000);
    byMinute.set(minute, {
      set_id: setId,
      minute,
      timestamp_ms: frame.timestamp,
      blue_total_gold: blueGold,
      red_total_gold: redGold,
      gold_diff: blueGold - redGold,
      blue_total_xp: blueXp,
      red_total_xp: redXp,
      xp_diff: blueXp - redXp,
      blue_total_cs: blueCs,
      red_total_cs: redCs,
      cs_diff: blueCs - redCs,
    });
  }

  return [...byMinute.values()].sort((a, b) => a.minute - b.minute);
}

function timelinePageFromPlatformGameId(platformGameId: string | null | undefined) {
  if (!platformGameId) return null;
  return `V5 data:${platformGameId.replace(/_/g, " ")}/Timeline`;
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

  // 1. timeline_events가 이미 있는 세트만 대상으로 조회 (행이 많을 수 있어 페이지네이션)
  const setIdsWithEventsSet = new Set<string>();
  {
    const PAGE = 1000;
    for (let offset = 0; ; offset += PAGE) {
      const { data: page, error: pageError } = await withSupabaseRetry(() => supabase
        .from("timeline_events")
        .select("set_id")
        .range(offset, offset + PAGE - 1));
      if (pageError) throw new Error(`세트 조회 실패: ${pageError.message}`);
      for (const row of (page ?? []) as { set_id: string }[]) setIdsWithEventsSet.add(row.set_id);
      if (!page || page.length < PAGE) break;
    }
  }
  const setIdsWithEvents = [...setIdsWithEventsSet];
  if (setIdsWithEvents.length === 0) {
    console.log("타임라인 이벤트가 있는 세트가 없습니다.");
    return;
  }

  // set_id 목록이 수백 개라 .in("id", ...)으로 걸면 URL이 너무 길어져 요청이 실패한다.
  // 대신 다른 필터로만 조회한 뒤 timeline_events가 있는 세트인지는 메모리에서 걸러낸다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let setsQuery: any = supabase
    .from("sets")
    .select("id, leaguepedia_game_id, riot_platform_game_id, blue_team_id, red_team_id")
    .not("leaguepedia_game_id", "is", null);

  if (matchId) setsQuery = setsQuery.eq("match_id", matchId);
  if (setId) setsQuery = setsQuery.eq("id", setId);
  if (segMatchIds) setsQuery = setsQuery.in("match_id", segMatchIds);

  const allSets: SetRow[] = [];
  {
    const PAGE = 1000;
    for (let offset = 0; ; offset += PAGE) {
      const { data: page, error: pageError } = await withSupabaseRetry<SetRow[]>(() => setsQuery.range(offset, offset + PAGE - 1));
      if (pageError) throw new Error(`세트 조회 실패: ${pageError.message}`);
      const rows = page ?? [];
      allSets.push(...rows);
      if (rows.length < PAGE) break;
    }
  }
  const sets = allSets.filter((s) => setIdsWithEventsSet.has(s.id));

  // 이미 프레임이 있는 세트 제외 (--force 아닐 경우)
  let targetSets: SetRow[] = sets;
  if (!force) {
    const existingFrameSetIds = new Set<string>();
    const CHUNK = 200;
    for (let i = 0; i < sets.length; i += CHUNK) {
      const chunk = sets.slice(i, i + CHUNK).map((s) => s.id);
      const { data: rows, error: framesError } = await withSupabaseRetry(() => supabase
        .from("match_timeline_frames")
        .select("set_id")
        .in("set_id", chunk));
      if (framesError) throw new Error(`프레임 조회 실패: ${framesError.message}`);
      for (const row of (rows ?? []) as { set_id: string }[]) existingFrameSetIds.add(row.set_id);
    }
    targetSets = targetSets.filter((s) => !existingFrameSetIds.has(s.id));
  }

  console.log(`처리할 세트: ${targetSets.length}개 (이벤트 있는 세트 ${sets.length}개 중)`);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const set of targetSets) {
    const gameId = set.leaguepedia_game_id!;
    process.stdout.write(`[${processed + failed + skipped + 1}/${targetSets.length}] ${gameId} ... `);

    try {
      await sleep(REQUEST_DELAY_MS);
      const metaRows = await cargoQuery({
        tables: "PostgameJsonMetadata",
        fields: "TimelinePage,RiotVersion",
        where: `GameId="${gameId.replace(/"/g, '\\"')}"`,
        limit: "1",
      });

      const timelinePage =
        metaRows[0]?.TimelinePage ?? timelinePageFromPlatformGameId(set.riot_platform_game_id);

      if (!timelinePage) {
        console.log("타임라인 페이지 없음 — 스킵");
        skipped++;
        continue;
      }

      await sleep(REQUEST_DELAY_MS);
      const rawContent = await fetchWikiPage(timelinePage);
      if (!rawContent) {
        console.log("위키 페이지 내용 없음 — 스킵");
        skipped++;
        continue;
      }

      let timeline: RiotTimeline;
      try {
        timeline = JSON.parse(rawContent) as RiotTimeline;
      } catch {
        console.log("JSON 파싱 실패 — 스킵");
        skipped++;
        continue;
      }

      if (!timeline.frames?.length) {
        console.log("frames 없음 — 스킵");
        skipped++;
        continue;
      }

      const { data: playerStats } = await supabase
        .from("set_player_stats")
        .select("set_id, player_id, team_id, position")
        .eq("set_id", set.id);

      const participantMap = buildParticipantMap(
        (playerStats ?? []) as PlayerStatRow[],
        set.blue_team_id,
        set.red_team_id,
      );

      const frames = parseTimelineFrames(
        timeline,
        set.id,
        set.blue_team_id,
        set.red_team_id,
        participantMap,
      );

      if (!frames.length) {
        console.log("참가자 매핑된 프레임 없음 — 스킵");
        skipped++;
        continue;
      }

      const BATCH = 200;
      let framesInserted = 0;
      for (let i = 0; i < frames.length; i += BATCH) {
        const batch = frames.slice(i, i + BATCH);
        const { error } = await supabase
          .from("match_timeline_frames")
          .upsert(batch, { onConflict: "set_id,minute" });
        if (error) throw new Error(`upsert 실패: ${error.message}`);
        framesInserted += batch.length;
      }

      console.log(`완료 (${framesInserted}개 프레임 저장)`);
      processed++;
    } catch (err) {
      console.log(`오류: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log(`\n완료: ${processed}개 성공, ${skipped}개 스킵, ${failed}개 실패`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
