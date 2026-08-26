import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAuthenticatedLeaguepediaApi } from "./leaguepedia-api.ts";

type SetRow = {
  id: string;
  leaguepedia_game_id: string | null;
  riot_platform_game_id: string | null;
  blue_team_id: string | null;
  red_team_id: string | null;
};

type PlayerStatRow = {
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
  participantId?: number;
  itemId?: number;
  skillSlot?: number;
  levelUpType?: string;
};

type RiotParticipantFrame = {
  level?: number;
  totalGold?: number;
  xp?: number;
  minionsKilled?: number;
  jungleMinionsKilled?: number;
};

type RiotTimeline = {
  frames?: Array<{
    timestamp: number;
    events?: RiotEvent[];
    participantFrames?: Record<string, RiotParticipantFrame>;
  }>;
};

export type LeaguepediaTimelineSyncResult = {
  status: "succeeded" | "waiting_for_source" | "rate_limited";
  eventCount: number;
  inserted: number;
  skipped: number;
  framesInserted: number;
  reason: string | null;
};

export type LeaguepediaTimelineSyncOptions = {
  /** 지정하면 해당 이벤트 종류만 저장한다. 기존 타임라인에 선수 빌드만 보충할 때 사용한다. */
  eventTypes?: string[];
  /** 선수 빌드 이벤트만 보충할 때 이미 존재하는 분당 프레임 재저장을 생략한다. */
  skipFrames?: boolean;
};

const POSITION_ORDER = ["TOP", "JGL", "MID", "BOT", "SUP"];

function buildParticipantMap(stats: PlayerStatRow[], blueTeamId: string, redTeamId: string) {
  const map = new Map<number, { playerId: string; teamId: string }>();
  const addTeam = (teamId: string, start: number) => {
    stats
      .filter((stat) => stat.team_id === teamId)
      .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position))
      .forEach((player, index) => map.set(start + index, { playerId: player.player_id, teamId }));
  };
  addTeam(blueTeamId, 1);
  addTeam(redTeamId, 6);
  return map;
}

function teamIdFromRiot(
  riotTeamId: number | undefined,
  blueTeamId: string,
  redTeamId: string,
) {
  if (riotTeamId === 100) return blueTeamId;
  if (riotTeamId === 200) return redTeamId;
  return null;
}

async function syncFinalParticipantLevels(
  supabase: SupabaseClient,
  timeline: RiotTimeline,
  setId: string,
  participantMap: Map<number, { playerId: string; teamId: string }>,
) {
  const finalFrame = timeline.frames?.at(-1);
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

export function parseLeaguepediaTimelineEvents(
  timeline: RiotTimeline,
  setId: string,
  blueTeamId: string,
  redTeamId: string,
  participantMap: Map<number, { playerId: string; teamId: string }>,
) {
  const rows = [] as Array<{
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
    raw_event_json: RiotEvent;
  }>;

  for (const frame of timeline.frames ?? []) {
    for (const event of frame.events ?? []) {
      const base = {
        set_id: setId,
        timestamp_ms: event.timestamp,
        minute: Math.floor(event.timestamp / 60_000),
        assist_player_ids: [] as string[],
        raw_event_json: event,
      };
      if (event.type === "CHAMPION_KILL") {
        const killer = event.killerId ? participantMap.get(event.killerId) : null;
        const victim = event.victimId ? participantMap.get(event.victimId) : null;
        rows.push({
          ...base,
          event_type: event.type,
          team_id: killer?.teamId ?? null,
          player_id: killer?.playerId ?? null,
          killer_player_id: killer?.playerId ?? null,
          victim_player_id: victim?.playerId ?? null,
          assist_player_ids: (event.assistingParticipantIds ?? [])
            .map((id) => participantMap.get(id)?.playerId)
            .filter((id): id is string => Boolean(id)),
          monster_type: null,
          building_type: null,
          lane_type: null,
        });
      } else if (event.type === "ELITE_MONSTER_KILL") {
        const killer = event.killerId ? participantMap.get(event.killerId) : null;
        rows.push({
          ...base,
          event_type: event.type,
          team_id: teamIdFromRiot(event.killerTeamId, blueTeamId, redTeamId),
          player_id: killer?.playerId ?? null,
          killer_player_id: killer?.playerId ?? null,
          victim_player_id: null,
          monster_type: event.monsterSubType ?? event.monsterType ?? null,
          building_type: null,
          lane_type: null,
        });
      } else if (event.type === "BUILDING_KILL") {
        const killer = event.killerId ? participantMap.get(event.killerId) : null;
        rows.push({
          ...base,
          event_type: event.type,
          team_id: teamIdFromRiot(event.teamId === 100 ? 200 : 100, blueTeamId, redTeamId),
          player_id: killer?.playerId ?? null,
          killer_player_id: killer?.playerId ?? null,
          victim_player_id: null,
          monster_type: null,
          building_type: event.buildingType ?? null,
          lane_type: event.laneType ?? null,
        });
      } else if (
        event.type === "ITEM_PURCHASED" ||
        event.type === "ITEM_SOLD" ||
        event.type === "ITEM_UNDO" ||
        event.type === "SKILL_LEVEL_UP"
      ) {
        const participant = event.participantId ? participantMap.get(event.participantId) : null;
        rows.push({
          ...base,
          event_type: event.type,
          team_id: participant?.teamId ?? null,
          player_id: participant?.playerId ?? null,
          killer_player_id: null,
          victim_player_id: null,
          monster_type: null,
          building_type: null,
          lane_type: null,
        });
      }
    }
  }
  return rows;
}

/** 라이엇 타임라인의 프레임별 participantFrames를 팀 단위 골드/경험치/CS 합계로 집계한다(분당 스냅샷). */
export function parseLeaguepediaTimelineFrames(
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

  for (const frame of timeline.frames ?? []) {
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

function timelinePageFromPlatformGameId(platformGameId: string | null) {
  return platformGameId ? `V5 data:${platformGameId.replace(/_/g, " ")}/Timeline` : null;
}

async function fetchApiJson(params: URLSearchParams) {
  const response = await fetchAuthenticatedLeaguepediaApi(params);
  const body = await response.json() as {
    error?: { code?: string; info?: string };
    cargoquery?: Array<{ title: Record<string, string> }>;
    query?: { pages?: Record<string, { revisions?: Array<{ "*": string }> }> };
  };
  if (response.status === 429 || body.error?.code === "ratelimited") {
    return { status: "rate_limited" as const, body };
  }
  if (!response.ok || body.error) {
    throw new Error(body.error?.info ?? `Leaguepedia timeline request failed (${response.status})`);
  }
  return { status: "ok" as const, body };
}

async function fetchTimelinePage(gameId: string) {
  const result = await fetchApiJson(new URLSearchParams({
    action: "cargoquery",
    format: "json",
    limit: "1",
    tables: "PostgameJsonMetadata",
    fields: "TimelinePage,RiotVersion",
    where: `GameId="${gameId.replace(/\\/g, "\\\\").replace(/\"/g, '\\"')}"`,
  }));
  if (result.status === "rate_limited") return result;
  return {
    status: "ok" as const,
    pageName: result.body.cargoquery?.[0]?.title.TimelinePage ?? null,
  };
}

async function fetchTimelineJson(pageName: string) {
  const result = await fetchApiJson(new URLSearchParams({
    action: "query",
    titles: pageName,
    prop: "revisions",
    rvprop: "content",
    format: "json",
  }));
  if (result.status === "rate_limited") return result;
  const page = Object.values(result.body.query?.pages ?? {})[0];
  const content = page?.revisions?.[0]?.["*"];
  if (!content) return { status: "ok" as const, timeline: null };
  try {
    return { status: "ok" as const, timeline: JSON.parse(content) as RiotTimeline };
  } catch {
    return { status: "ok" as const, timeline: null };
  }
}

async function insertTimelineEventBatch(
  supabase: SupabaseClient,
  batch: ReturnType<typeof parseLeaguepediaTimelineEvents>,
): Promise<{ inserted: number; skipped: number }> {
  if (batch.length === 0) return { inserted: 0, skipped: 0 };

  const { error } = await supabase.from("timeline_events").insert(batch);
  if (!error) return { inserted: batch.length, skipped: 0 };
  if (error.code !== "23505") throw error;
  if (batch.length === 1) return { inserted: 0, skipped: 1 };

  // 한 건의 중복 때문에 최대 200건을 전부 개별 INSERT하지 않도록 이분 탐색한다.
  // 정상 행은 큰 묶음으로 저장하고, 실제 중복 행만 단건까지 좁혀서 건너뛴다.
  const middle = Math.floor(batch.length / 2);
  const [left, right] = await Promise.all([
    insertTimelineEventBatch(supabase, batch.slice(0, middle)),
    insertTimelineEventBatch(supabase, batch.slice(middle)),
  ]);
  return {
    inserted: left.inserted + right.inserted,
    skipped: left.skipped + right.skipped,
  };
}

export async function syncLeaguepediaTimelineForSet(
  supabase: SupabaseClient,
  setId: string,
  options: LeaguepediaTimelineSyncOptions = {},
): Promise<LeaguepediaTimelineSyncResult> {
  const { data: set, error: setError } = await supabase
    .from("sets")
    .select("id, leaguepedia_game_id, riot_platform_game_id, blue_team_id, red_team_id")
    .eq("id", setId)
    .single();
  if (setError) throw setError;
  const typedSet = set as SetRow;
  if (!typedSet.leaguepedia_game_id || !typedSet.blue_team_id || !typedSet.red_team_id) {
    return { status: "waiting_for_source", eventCount: 0, inserted: 0, skipped: 0, framesInserted: 0, reason: "Set source IDs or sides are missing" };
  }

  const { data: stats, error: statsError } = await supabase
    .from("set_player_stats")
    .select("player_id, team_id, position")
    .eq("set_id", setId);
  if (statsError) throw statsError;
  if ((stats ?? []).length < 10) {
    return { status: "waiting_for_source", eventCount: 0, inserted: 0, skipped: 0, framesInserted: 0, reason: `Player mapping is incomplete: players=${stats?.length ?? 0}` };
  }

  const pageResult = await fetchTimelinePage(typedSet.leaguepedia_game_id);
  if (pageResult.status === "rate_limited") {
    return { status: "rate_limited", eventCount: 0, inserted: 0, skipped: 0, framesInserted: 0, reason: "Leaguepedia timeline metadata was rate limited" };
  }
  const pageName = pageResult.pageName ?? timelinePageFromPlatformGameId(typedSet.riot_platform_game_id);
  if (!pageName) {
    return { status: "waiting_for_source", eventCount: 0, inserted: 0, skipped: 0, framesInserted: 0, reason: "TimelinePage is not available yet" };
  }

  const timelineResult = await fetchTimelineJson(pageName);
  if (timelineResult.status === "rate_limited") {
    return { status: "rate_limited", eventCount: 0, inserted: 0, skipped: 0, framesInserted: 0, reason: "Leaguepedia timeline page was rate limited" };
  }
  if (!timelineResult.timeline?.frames?.length) {
    return { status: "waiting_for_source", eventCount: 0, inserted: 0, skipped: 0, framesInserted: 0, reason: "Timeline frames are not available yet" };
  }

  const participantMap = buildParticipantMap(
    (stats ?? []) as PlayerStatRow[],
    typedSet.blue_team_id,
    typedSet.red_team_id,
  );
  await syncFinalParticipantLevels(supabase, timelineResult.timeline, setId, participantMap);

  const parsedEvents = parseLeaguepediaTimelineEvents(
    timelineResult.timeline,
    setId,
    typedSet.blue_team_id,
    typedSet.red_team_id,
    participantMap,
  );
  const selectedEventTypes = options.eventTypes ? new Set(options.eventTypes) : null;
  const events = selectedEventTypes
    ? parsedEvents.filter((event) => selectedEventTypes.has(event.event_type))
    : parsedEvents;
  const frames = options.skipFrames
    ? []
    : parseLeaguepediaTimelineFrames(
        timelineResult.timeline,
        setId,
        typedSet.blue_team_id,
        typedSet.red_team_id,
        participantMap,
      );
  if (events.length === 0 && frames.length === 0) {
    return { status: "waiting_for_source", eventCount: 0, inserted: 0, skipped: 0, framesInserted: 0, reason: "Timeline contains no supported events" };
  }

  let inserted = 0;
  let skipped = 0;
  for (let index = 0; index < events.length; index += 200) {
    const batch = events.slice(index, index + 200);
    const result = await insertTimelineEventBatch(supabase, batch);
    inserted += result.inserted;
    skipped += result.skipped;
  }

  let framesInserted = 0;
  for (let index = 0; index < frames.length; index += 200) {
    const batch = frames.slice(index, index + 200);
    const { error } = await supabase.from("match_timeline_frames").upsert(batch, { onConflict: "set_id,minute" });
    if (error) throw error;
    framesInserted += batch.length;
  }

  return { status: "succeeded", eventCount: events.length, inserted, skipped, framesInserted, reason: null };
}

export type TimelineSyncSummary = {
  matchId: string;
  setsProcessed: number;
  setsFailed: number;
  eventsInserted: number;
  framesInserted: number;
};

/**
 * 매치의 모든 세트 타임라인을 인증된 Leaguepedia 세션으로 동기화한다(관리자 UI 전용
 * 진입점). syncLeaguepediaTimelineForSet을 세트별로 순회 호출하며, 익명 호출보다
 * 레이트리밋에 훨씬 덜 걸린다.
 */
export async function syncLeaguepediaTimelineForMatch(
  supabase: SupabaseClient,
  matchId: string,
  force = false,
): Promise<TimelineSyncSummary> {
  const { data: sets, error } = await supabase
    .from("sets")
    .select("id")
    .eq("match_id", matchId)
    .not("leaguepedia_game_id", "is", null);
  if (error) throw error;
  if (!sets?.length) throw new Error("해당 경기에 세트가 없거나 Leaguepedia Game ID가 없습니다.");

  let targetSetIds = (sets as Array<{ id: string }>).map((set) => set.id);
  if (!force) {
    const { data: existingSetIds } = await supabase
      .from("timeline_events")
      .select("set_id")
      .in("set_id", targetSetIds);
    const done = new Set((existingSetIds ?? []).map((row: { set_id: string }) => row.set_id));
    targetSetIds = targetSetIds.filter((id) => !done.has(id));
  }

  let setsProcessed = 0;
  let setsFailed = 0;
  let eventsInserted = 0;
  let framesInserted = 0;

  for (const setId of targetSetIds) {
    if (force) {
      await supabase.from("timeline_events").delete().eq("set_id", setId);
      await supabase.from("match_timeline_frames").delete().eq("set_id", setId);
    }
    try {
      const result = await syncLeaguepediaTimelineForSet(supabase, setId);
      if (result.status === "succeeded") {
        eventsInserted += result.inserted;
        framesInserted += result.framesInserted;
        setsProcessed += 1;
      }
      // waiting_for_source/rate_limited: 소스가 아직 없거나 잠시 막힌 것이라 실패로 세지
      // 않고 건너뛴다 — 크론 자동화가 이어서 재시도한다.
    } catch {
      setsFailed += 1;
    }
  }

  return { matchId, setsProcessed, setsFailed, eventsInserted, framesInserted };
}
