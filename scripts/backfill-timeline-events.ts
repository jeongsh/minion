/**
 * Leaguepedia PostgameJsonMetadata에서 타임라인 JSON을 가져와
 * timeline_events 테이블에 저장하는 백필 스크립트.
 *
 * 실행:
 *   npx tsx scripts/backfill-timeline-events.ts [--force] [--match <matchId>] [--set <setId>]
 *
 * --force: 이미 이벤트가 있는 세트도 덮어씀
 * --match: 특정 매치 ID만 처리
 * --set: 특정 세트 ID만 처리
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

// ─── 타입 ──────────────────────────────────────────────────────

type SetRow = {
  id: string;
  leaguepedia_game_id: string | null;
  riot_platform_game_id: string | null;
  blue_team_id: string;
  red_team_id: string;
  duration_seconds: number | null;
};

type PlayerStatRow = {
  set_id: string;
  player_id: string;
  team_id: string;
  position: string;
};

// Riot match-v5 타임라인 이벤트 타입
type RiotEvent = {
  type: string;
  timestamp: number;
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  killerTeamId?: number;
  teamId?: number;
  monsterType?: string;
  monsterSubType?: string;
  buildingType?: string;
  laneType?: string;
  towerType?: string;
  position?: { x: number; y: number };
};

type RiotFrame = {
  timestamp: number;
  events: RiotEvent[];
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

function isRateLimited(body: { error?: { code?: string } } | null | undefined) {
  return body?.error?.code === "ratelimited";
}

async function cargoQuery(params: Record<string, string>): Promise<Record<string, string>[]> {
  const urlParams = new URLSearchParams({ action: "cargoquery", format: "json", limit: "500" });
  for (const [k, v] of Object.entries(params)) urlParams.set(k, v);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(`${CARGO_API}?${urlParams}`, {
      headers: { "user-agent": "LCKHubMinion/0.1 (backfill-timeline)" },
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
      headers: { "user-agent": "LCKHubMinion/0.1 (backfill-timeline)" },
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

function teamIdFromRiot(
  riotTeamId: number | undefined,
  blueTeamId: string,
  redTeamId: string,
): string | null {
  if (riotTeamId === 100) return blueTeamId;
  if (riotTeamId === 200) return redTeamId;
  return null;
}

function parseTimelineEvents(
  timeline: RiotTimeline,
  setId: string,
  blueTeamId: string,
  redTeamId: string,
  participantMap: Map<number, { playerId: string; teamId: string }>,
) {
  const rows: Array<{
    set_id: string;
    timestamp_ms: number;
    minute: number;
    event_type: string;
    team_id: string | null;
    player_id: string | null;
    killer_player_id: string | null;
    victim_player_id: string | null;
    assist_player_ids: string[];
    monster_type: string | null;
    building_type: string | null;
    lane_type: string | null;
    raw_event_json: object;
  }> = [];

  for (const frame of timeline.frames) {
    for (const event of frame.events) {
      const tsMs = event.timestamp;
      const minute = Math.floor(tsMs / 60000);

      if (event.type === "CHAMPION_KILL") {
        const killer = event.killerId ? participantMap.get(event.killerId) : null;
        const victim = event.victimId ? participantMap.get(event.victimId) : null;
        const assists = (event.assistingParticipantIds ?? [])
          .map((id) => participantMap.get(id)?.playerId)
          .filter((id): id is string => Boolean(id));

        rows.push({
          set_id: setId,
          timestamp_ms: tsMs,
          minute,
          event_type: "CHAMPION_KILL",
          team_id: killer?.teamId ?? null,
          player_id: killer?.playerId ?? null,
          killer_player_id: killer?.playerId ?? null,
          victim_player_id: victim?.playerId ?? null,
          assist_player_ids: assists,
          monster_type: null,
          building_type: null,
          lane_type: null,
          raw_event_json: event,
        });
      } else if (event.type === "ELITE_MONSTER_KILL") {
        const killerTeamId = teamIdFromRiot(event.killerTeamId, blueTeamId, redTeamId);
        const killer = event.killerId ? participantMap.get(event.killerId) : null;

        rows.push({
          set_id: setId,
          timestamp_ms: tsMs,
          minute,
          event_type: "ELITE_MONSTER_KILL",
          team_id: killerTeamId,
          player_id: killer?.playerId ?? null,
          killer_player_id: killer?.playerId ?? null,
          victim_player_id: null,
          assist_player_ids: [],
          monster_type: event.monsterSubType ?? event.monsterType ?? null,
          building_type: null,
          lane_type: null,
          raw_event_json: event,
        });
      } else if (event.type === "BUILDING_KILL") {
        const killerTeamId = teamIdFromRiot(event.teamId === 100 ? 200 : 100, blueTeamId, redTeamId);
        const killer = event.killerId ? participantMap.get(event.killerId) : null;

        rows.push({
          set_id: setId,
          timestamp_ms: tsMs,
          minute,
          event_type: "BUILDING_KILL",
          team_id: killerTeamId,
          player_id: killer?.playerId ?? null,
          killer_player_id: killer?.playerId ?? null,
          victim_player_id: null,
          assist_player_ids: [],
          monster_type: null,
          building_type: event.buildingType ?? null,
          lane_type: event.laneType ?? null,
          raw_event_json: event,
        });
      }
    }
  }

  return rows;
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

  // 1. 처리할 세트 목록 조회
  let setsQuery = supabase
    .from("sets")
    .select("id, leaguepedia_game_id, riot_platform_game_id, blue_team_id, red_team_id, duration_seconds")
    .not("leaguepedia_game_id", "is", null);

  if (matchId) setsQuery = setsQuery.eq("match_id", matchId);
  if (setId) setsQuery = setsQuery.eq("id", setId);

  const { data: sets, error: setsError } = await setsQuery;
  if (setsError || !sets) throw new Error(`세트 조회 실패: ${setsError?.message}`);

  // 이미 이벤트가 있는 세트 제외 (--force 아닐 경우)
  let targetSets: SetRow[] = sets as SetRow[];
  if (!force) {
    const { data: existingSetIds } = await supabase
      .from("timeline_events")
      .select("set_id")
      .in("set_id", sets.map((s) => s.id));
    const done = new Set((existingSetIds ?? []).map((r: { set_id: string }) => r.set_id));
    targetSets = targetSets.filter((s) => !done.has(s.id));
  }

  console.log(`처리할 세트: ${targetSets.length}개 (전체 ${sets.length}개)`);

  let processed = 0;
  let failed = 0;

  for (const set of targetSets) {
    const gameId = set.leaguepedia_game_id!;
    process.stdout.write(`[${processed + 1}/${targetSets.length}] ${gameId} ... `);

    try {
      // 2. PostgameJsonMetadata에서 TimelinePage 조회
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
        continue;
      }

      // 3. 위키 페이지에서 타임라인 JSON 가져오기
      await sleep(REQUEST_DELAY_MS);
      const rawContent = await fetchWikiPage(timelinePage);
      if (!rawContent) {
        console.log("위키 페이지 내용 없음 — 스킵");
        continue;
      }

      let timeline: RiotTimeline;
      try {
        timeline = JSON.parse(rawContent) as RiotTimeline;
      } catch {
        console.log("JSON 파싱 실패 — 스킵");
        continue;
      }

      if (!timeline.frames?.length) {
        console.log("frames 없음 — 스킵");
        continue;
      }

      // 4. 선수 스탯으로 participantId → player_id 맵 구성
      const { data: playerStats } = await supabase
        .from("set_player_stats")
        .select("set_id, player_id, team_id, position")
        .eq("set_id", set.id);

      const participantMap = buildParticipantMap(
        (playerStats ?? []) as PlayerStatRow[],
        set.blue_team_id,
        set.red_team_id,
      );

      // 5. 이벤트 파싱
      const events = parseTimelineEvents(
        timeline,
        set.id,
        set.blue_team_id,
        set.red_team_id,
        participantMap,
      );

      if (!events.length) {
        console.log("이벤트 없음 — 스킵");
        continue;
      }

      // 6. 이벤트 삽입 (중복은 skip)
      if (force) {
        await supabase.from("timeline_events").delete().eq("set_id", set.id);
      }

      const BATCH = 200;
      let inserted = 0;
      let skipped = 0;
      for (let i = 0; i < events.length; i += BATCH) {
        const batch = events.slice(i, i + BATCH);
        const { error } = await supabase.from("timeline_events").insert(batch);
        if (!error) {
          inserted += batch.length;
          continue;
        }
        if (error.code !== "23505") throw new Error(`insert 실패: ${error.message}`);
        // 배치에 중복 포함 → 개별 삽입으로 폴백
        for (const ev of batch) {
          const { error: e2 } = await supabase.from("timeline_events").insert(ev);
          if (!e2) inserted++;
          else if (e2.code === "23505") skipped++;
          else throw new Error(`insert 실패: ${e2.message}`);
        }
      }

      console.log(`완료 (${inserted}개 삽입${skipped ? `, ${skipped}개 중복 skip` : ""})`);
      processed++;
    } catch (err) {
      console.log(`오류: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log(`\n완료: ${processed}개 성공, ${failed}개 실패`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
