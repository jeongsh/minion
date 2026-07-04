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
};

type RiotTimeline = {
  frames?: Array<{ timestamp: number; events?: RiotEvent[] }>;
};

export type LeaguepediaTimelineSyncResult = {
  status: "succeeded" | "waiting_for_source" | "rate_limited";
  eventCount: number;
  inserted: number;
  skipped: number;
  reason: string | null;
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
      }
    }
  }
  return rows;
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

export async function syncLeaguepediaTimelineForSet(
  supabase: SupabaseClient,
  setId: string,
): Promise<LeaguepediaTimelineSyncResult> {
  const { data: set, error: setError } = await supabase
    .from("sets")
    .select("id, leaguepedia_game_id, riot_platform_game_id, blue_team_id, red_team_id")
    .eq("id", setId)
    .single();
  if (setError) throw setError;
  const typedSet = set as SetRow;
  if (!typedSet.leaguepedia_game_id || !typedSet.blue_team_id || !typedSet.red_team_id) {
    return { status: "waiting_for_source", eventCount: 0, inserted: 0, skipped: 0, reason: "Set source IDs or sides are missing" };
  }

  const { data: stats, error: statsError } = await supabase
    .from("set_player_stats")
    .select("player_id, team_id, position")
    .eq("set_id", setId);
  if (statsError) throw statsError;
  if ((stats ?? []).length < 10) {
    return { status: "waiting_for_source", eventCount: 0, inserted: 0, skipped: 0, reason: `Player mapping is incomplete: players=${stats?.length ?? 0}` };
  }

  const pageResult = await fetchTimelinePage(typedSet.leaguepedia_game_id);
  if (pageResult.status === "rate_limited") {
    return { status: "rate_limited", eventCount: 0, inserted: 0, skipped: 0, reason: "Leaguepedia timeline metadata was rate limited" };
  }
  const pageName = pageResult.pageName ?? timelinePageFromPlatformGameId(typedSet.riot_platform_game_id);
  if (!pageName) {
    return { status: "waiting_for_source", eventCount: 0, inserted: 0, skipped: 0, reason: "TimelinePage is not available yet" };
  }

  const timelineResult = await fetchTimelineJson(pageName);
  if (timelineResult.status === "rate_limited") {
    return { status: "rate_limited", eventCount: 0, inserted: 0, skipped: 0, reason: "Leaguepedia timeline page was rate limited" };
  }
  if (!timelineResult.timeline?.frames?.length) {
    return { status: "waiting_for_source", eventCount: 0, inserted: 0, skipped: 0, reason: "Timeline frames are not available yet" };
  }

  const events = parseLeaguepediaTimelineEvents(
    timelineResult.timeline,
    setId,
    typedSet.blue_team_id,
    typedSet.red_team_id,
    buildParticipantMap((stats ?? []) as PlayerStatRow[], typedSet.blue_team_id, typedSet.red_team_id),
  );
  if (events.length === 0) {
    return { status: "waiting_for_source", eventCount: 0, inserted: 0, skipped: 0, reason: "Timeline contains no supported events" };
  }

  let inserted = 0;
  let skipped = 0;
  for (let index = 0; index < events.length; index += 200) {
    const batch = events.slice(index, index + 200);
    const { error } = await supabase.from("timeline_events").insert(batch);
    if (!error) {
      inserted += batch.length;
      continue;
    }
    if (error.code !== "23505") throw error;
    for (const event of batch) {
      const { error: eventError } = await supabase.from("timeline_events").insert(event);
      if (!eventError) inserted += 1;
      else if (eventError.code === "23505") skipped += 1;
      else throw eventError;
    }
  }
  return { status: "succeeded", eventCount: events.length, inserted, skipped, reason: null };
}
