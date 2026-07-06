import type { SupabaseClient } from "@supabase/supabase-js";

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 6;

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
};

type RiotParticipantFrame = {
  level?: number;
  totalGold?: number;
  xp?: number;
  minionsKilled?: number;
  jungleMinionsKilled?: number;
};
type RiotFrame = {
  timestamp: number;
  events: RiotEvent[];
  participantFrames?: Record<string, RiotParticipantFrame>;
};
type RiotTimeline = { frames: RiotFrame[] };

async function syncFinalParticipantLevels(
  supabase: SupabaseClient,
  timeline: RiotTimeline,
  setId: string,
  participantMap: Map<number, { playerId: string; teamId: string }>,
) {
  const finalFrame = timeline.frames.at(-1);
  for (const [participantId, frame] of Object.entries(finalFrame?.participantFrames ?? {})) {
    const participant = participantMap.get(Number(participantId));
    const level = frame.level;
    if (!participant || typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 18) continue;
    const { error } = await supabase
      .from("set_player_stats")
      .update({ champion_level: level })
      .eq("set_id", setId)
      .eq("player_id", participant.playerId);
    if (error) throw error;
  }
}

export type TimelineSyncSummary = {
  matchId: string;
  setsProcessed: number;
  setsFailed: number;
  eventsInserted: number;
  framesInserted: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function cargoQuery(params: Record<string, string>): Promise<Record<string, string>[]> {
  const urlParams = new URLSearchParams({ action: "cargoquery", format: "json", limit: "500" });
  for (const [k, v] of Object.entries(params)) urlParams.set(k, v);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(`${CARGO_API}?${urlParams}`, {
      headers: { "user-agent": "LCKHubMinion/0.1 (timeline-sync)" },
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
    if (body.error?.code === "ratelimited") {
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
      headers: { "user-agent": "LCKHubMinion/0.1 (timeline-sync)" },
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
    if (body.error?.code === "ratelimited") {
      await sleep(REQUEST_DELAY_MS * (attempt + 2));
      continue;
    }
    const pages = body.query?.pages ?? {};
    const page = Object.values(pages)[0];
    if (!page?.revisions?.length) return null;
    return page.revisions[0]["*"];
  }
  throw new Error("Wiki 페이지 최대 재시도 초과");
}

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

function teamIdFromRiot(riotTeamId: number | undefined, blueTeamId: string, redTeamId: string) {
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
          set_id: setId, timestamp_ms: tsMs, minute, event_type: "CHAMPION_KILL",
          team_id: killer?.teamId ?? null, player_id: killer?.playerId ?? null,
          killer_player_id: killer?.playerId ?? null, victim_player_id: victim?.playerId ?? null,
          assist_player_ids: assists, monster_type: null, building_type: null, lane_type: null,
          raw_event_json: event,
        });
      } else if (event.type === "ELITE_MONSTER_KILL") {
        const killerTeamId = teamIdFromRiot(event.killerTeamId, blueTeamId, redTeamId);
        const killer = event.killerId ? participantMap.get(event.killerId) : null;
        rows.push({
          set_id: setId, timestamp_ms: tsMs, minute, event_type: "ELITE_MONSTER_KILL",
          team_id: killerTeamId, player_id: killer?.playerId ?? null,
          killer_player_id: killer?.playerId ?? null, victim_player_id: null,
          assist_player_ids: [], monster_type: event.monsterSubType ?? event.monsterType ?? null,
          building_type: null, lane_type: null, raw_event_json: event,
        });
      } else if (event.type === "BUILDING_KILL") {
        const killerTeamId = teamIdFromRiot(event.teamId === 100 ? 200 : 100, blueTeamId, redTeamId);
        const killer = event.killerId ? participantMap.get(event.killerId) : null;
        rows.push({
          set_id: setId, timestamp_ms: tsMs, minute, event_type: "BUILDING_KILL",
          team_id: killerTeamId, player_id: killer?.playerId ?? null,
          killer_player_id: killer?.playerId ?? null, victim_player_id: null,
          assist_player_ids: [], monster_type: null,
          building_type: event.buildingType ?? null, lane_type: event.laneType ?? null,
          raw_event_json: event,
        });
      }
    }
  }
  return rows;
}

/** 라이엇 타임라인의 프레임별 participantFrames를 팀 단위 골드/경험치/CS 합계로 집계한다(분당 스냅샷). */
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

    if (!hasBlue || !hasRed) continue; // 참가자 매핑이 안 된 프레임은 건너뛴다

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

async function syncSetTimeline(
  supabase: SupabaseClient,
  set: SetRow,
  force: boolean,
): Promise<{ inserted: number; framesInserted: number; skipped: boolean }> {
  await sleep(REQUEST_DELAY_MS);
  const metaRows = await cargoQuery({
    tables: "PostgameJsonMetadata",
    fields: "TimelinePage,RiotVersion",
    where: `GameId="${set.leaguepedia_game_id!.replace(/"/g, '\\"')}"`,
    limit: "1",
  });

  const timelinePage =
    metaRows[0]?.TimelinePage ?? timelinePageFromPlatformGameId(set.riot_platform_game_id);

  if (!timelinePage) return { inserted: 0, framesInserted: 0, skipped: true };

  await sleep(REQUEST_DELAY_MS);
  const rawContent = await fetchWikiPage(timelinePage);
  if (!rawContent) return { inserted: 0, framesInserted: 0, skipped: true };

  let timeline: RiotTimeline;
  try {
    timeline = JSON.parse(rawContent) as RiotTimeline;
  } catch {
    return { inserted: 0, framesInserted: 0, skipped: true };
  }

  if (!timeline.frames?.length) return { inserted: 0, framesInserted: 0, skipped: true };

  const { data: playerStats } = await supabase
    .from("set_player_stats")
    .select("set_id, player_id, team_id, position")
    .eq("set_id", set.id);

  const participantMap = buildParticipantMap(
    (playerStats ?? []) as PlayerStatRow[],
    set.blue_team_id,
    set.red_team_id,
  );

  await syncFinalParticipantLevels(supabase, timeline, set.id, participantMap);

  const events = parseTimelineEvents(timeline, set.id, set.blue_team_id, set.red_team_id, participantMap);
  const frames = parseTimelineFrames(timeline, set.id, set.blue_team_id, set.red_team_id, participantMap);
  if (!events.length && !frames.length) return { inserted: 0, framesInserted: 0, skipped: true };

  if (force) {
    await supabase.from("timeline_events").delete().eq("set_id", set.id);
    await supabase.from("match_timeline_frames").delete().eq("set_id", set.id);
  }

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
    const { error } = await supabase.from("timeline_events").insert(batch);
    if (!error) {
      inserted += batch.length;
      continue;
    }
    if (error.code !== "23505") throw new Error(`insert 실패: ${error.message}`);
    for (const ev of batch) {
      const { error: e2 } = await supabase.from("timeline_events").insert(ev);
      if (!e2) inserted++;
      else if (e2.code !== "23505") throw new Error(`insert 실패: ${e2.message}`);
    }
  }

  let framesInserted = 0;
  for (let i = 0; i < frames.length; i += BATCH) {
    const batch = frames.slice(i, i + BATCH);
    const { error } = await supabase
      .from("match_timeline_frames")
      .upsert(batch, { onConflict: "set_id,minute" });
    if (error) throw new Error(`골드 프레임 저장 실패: ${error.message}`);
    framesInserted += batch.length;
  }

  return { inserted, framesInserted, skipped: false };
}

/**
 * 이미 timeline_events가 있는 세트에 골드 프레임만 추가로 채운다(이벤트는 건드리지 않음).
 * 과거 경기 백필용 — 라이엇 타임라인 JSON을 다시 받아 프레임만 파싱해 upsert한다.
 */
export async function backfillSetTimelineFrames(
  supabase: SupabaseClient,
  set: SetRow,
): Promise<{ framesInserted: number; skipped: boolean; reason?: string }> {
  await sleep(REQUEST_DELAY_MS);
  const metaRows = await cargoQuery({
    tables: "PostgameJsonMetadata",
    fields: "TimelinePage,RiotVersion",
    where: `GameId="${set.leaguepedia_game_id!.replace(/"/g, '\\"')}"`,
    limit: "1",
  });

  const timelinePage =
    metaRows[0]?.TimelinePage ?? timelinePageFromPlatformGameId(set.riot_platform_game_id);
  if (!timelinePage) return { framesInserted: 0, skipped: true, reason: "TimelinePage 없음" };

  await sleep(REQUEST_DELAY_MS);
  const rawContent = await fetchWikiPage(timelinePage);
  if (!rawContent) return { framesInserted: 0, skipped: true, reason: "타임라인 페이지 없음" };

  let timeline: RiotTimeline;
  try {
    timeline = JSON.parse(rawContent) as RiotTimeline;
  } catch {
    return { framesInserted: 0, skipped: true, reason: "타임라인 JSON 파싱 실패" };
  }
  if (!timeline.frames?.length) return { framesInserted: 0, skipped: true, reason: "프레임 없음" };

  const { data: playerStats } = await supabase
    .from("set_player_stats")
    .select("set_id, player_id, team_id, position")
    .eq("set_id", set.id);

  const participantMap = buildParticipantMap(
    (playerStats ?? []) as PlayerStatRow[],
    set.blue_team_id,
    set.red_team_id,
  );

  const frames = parseTimelineFrames(timeline, set.id, set.blue_team_id, set.red_team_id, participantMap);
  if (!frames.length) return { framesInserted: 0, skipped: true, reason: "참가자 매핑된 프레임 없음" };

  const BATCH = 200;
  let framesInserted = 0;
  for (let i = 0; i < frames.length; i += BATCH) {
    const batch = frames.slice(i, i + BATCH);
    const { error } = await supabase
      .from("match_timeline_frames")
      .upsert(batch, { onConflict: "set_id,minute" });
    if (error) throw new Error(`골드 프레임 저장 실패: ${error.message}`);
    framesInserted += batch.length;
  }

  return { framesInserted, skipped: false };
}

export async function syncMatchTimeline(
  supabase: SupabaseClient,
  matchId: string,
  force = false,
): Promise<TimelineSyncSummary> {
  const { data: sets, error } = await supabase
    .from("sets")
    .select("id, leaguepedia_game_id, riot_platform_game_id, blue_team_id, red_team_id, duration_seconds")
    .eq("match_id", matchId)
    .not("leaguepedia_game_id", "is", null);

  if (error) throw error;
  if (!sets?.length) throw new Error("해당 경기에 세트가 없거나 Leaguepedia Game ID가 없습니다.");

  let targetSets = sets as SetRow[];
  if (!force) {
    const { data: existingSetIds } = await supabase
      .from("timeline_events")
      .select("set_id")
      .in("set_id", sets.map((s) => s.id));
    const done = new Set((existingSetIds ?? []).map((r: { set_id: string }) => r.set_id));
    targetSets = targetSets.filter((s) => !done.has(s.id));
  }

  if (!targetSets.length) {
    return { matchId, setsProcessed: 0, setsFailed: 0, eventsInserted: 0, framesInserted: 0 };
  }

  let setsProcessed = 0;
  let setsFailed = 0;
  let eventsInserted = 0;
  let framesInserted = 0;

  for (const set of targetSets) {
    try {
      const result = await syncSetTimeline(supabase, set, force);
      if (!result.skipped) {
        eventsInserted += result.inserted;
        framesInserted += result.framesInserted;
        setsProcessed++;
      }
    } catch {
      setsFailed++;
    }
  }

  return { matchId, setsProcessed, setsFailed, eventsInserted, framesInserted };
}
