import { NextResponse } from "next/server";

import { getAllTeams, getMatchById } from "@/lib/data/lck";
import { fetchLolesportsGameData } from "@/lib/lolesports-game-data";
import { fetchTrackedLolesportsEvents } from "@/lib/lolesports";
import { findLolesportsMatch } from "@/lib/lolesports-match-matcher";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// 여러 명이 동시에 폴링해도 이 창 안에서는 캐시된 응답 하나만 재사용해서, 우리 서버가
// feed.lolesports.com/esports-api와 DB를 매 요청마다 다시 두드리지 않게 한다. diff/저장도
// 이 창 안에서 딱 한 번만 실행된다(캐시 미스일 때만 아래 GET 본문이 돈다).
export const revalidate = 8;

type Side = "blue" | "red";

type LiveSideSummary = {
  teamId: string | null;
  totalGold: number | null;
  kills: number;
  towers: number;
  barons: number;
  inhibitors: number;
  dragonTypes: string[];
};

export type LiveMatchParticipant = {
  side: Side;
  summonerName: string | null;
  championId: string | null;
  kills: number;
  deaths: number;
  assists: number;
};

export type LiveMatchEvent = {
  id: string;
  time: number;
  type: "kill" | "tower" | "baron" | "inhibitor" | "dragon" | "end";
  side: Side | null;
  teamId: string | null;
  killerSummonerName: string | null;
  killerChampionId: string | null;
  victimSummonerName: string | null;
  victimChampionId: string | null;
  dragonType: string | null;
};

export type LiveMatchResponse =
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "not_started"; events: LiveMatchEvent[] }
  | { status: "ended"; events: LiveMatchEvent[] }
  | {
      status: "live";
      durationSeconds: number | null;
      blue: LiveSideSummary;
      red: LiveSideSummary;
      participants: LiveMatchParticipant[];
      events: LiveMatchEvent[];
    };

type CursorRow = {
  match_id: string;
  lolesports_game_id: string;
  blue_team_id: string | null;
  red_team_id: string | null;
  blue_towers: number;
  red_towers: number;
  blue_barons: number;
  red_barons: number;
  blue_inhibitors: number;
  red_inhibitors: number;
  blue_dragon_types: string[];
  red_dragon_types: string[];
  participant_stats: Record<string, { kills: number; deaths: number; championId: string | null }>;
  duration_seconds: number | null;
};

type EventRow = {
  id: string;
  event_type: LiveMatchEvent["type"];
  side: Side | null;
  team_id: string | null;
  killer_summoner_name: string | null;
  killer_champion_id: string | null;
  victim_summoner_name: string | null;
  victim_champion_id: string | null;
  dragon_type: string | null;
  game_clock_seconds: number;
};

type NewEventInsert = {
  match_id: string;
  event_type: LiveMatchEvent["type"];
  side: Side | null;
  team_id: string | null;
  killer_summoner_name: string | null;
  killer_champion_id: string | null;
  victim_summoner_name: string | null;
  victim_champion_id: string | null;
  dragon_type: string | null;
  game_clock_seconds: number;
};

// feed.lolesports.com은 비공식 API라 가끔 정상적인 요청에도 일시적으로 400/네트워크
// 오류를 준다(같은 요청을 잠시 후 다시 보내면 성공하는 경우가 대부분). 재시도 없이 바로
// "unavailable"로 떨어뜨리면 경기가 멀쩡히 진행 중인데도 실시간 탭이 자주 끊겨 보인다.
async function withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 700): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function side(team: { totalGold?: number | null } | null | undefined, teamId: string | null): LiveSideSummary {
  return {
    teamId,
    totalGold: typeof team?.totalGold === "number" ? team.totalGold : null,
    kills: 0,
    towers: 0,
    barons: 0,
    inhibitors: 0,
    dragonTypes: [],
  };
}

function participantKey(participantSide: Side, summonerName: string | null) {
  return `${participantSide}-${summonerName ?? ""}`;
}

function mapEventRow(row: EventRow): LiveMatchEvent {
  return {
    id: row.id,
    time: row.game_clock_seconds,
    type: row.event_type,
    side: row.side,
    teamId: row.team_id,
    killerSummonerName: row.killer_summoner_name,
    killerChampionId: row.killer_champion_id,
    victimSummonerName: row.victim_summoner_name,
    victimChampionId: row.victim_champion_id,
    dragonType: row.dragon_type,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadEvents(supabase: any, matchId: string): Promise<LiveMatchEvent[]> {
  const { data } = await supabase
    .from("live_match_events")
    .select("id, event_type, side, team_id, killer_summoner_name, killer_champion_id, victim_summoner_name, victim_champion_id, dragon_type, game_clock_seconds")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as EventRow[]).map(mapEventRow);
}

/** 직전 커서와 지금 스냅샷을 비교해 새로 생긴 킬/오브젝트를 이벤트 행으로 만든다. */
function buildNewEvents(
  matchId: string,
  cursor: CursorRow,
  snapshot: { blue: LiveSideSummary; red: LiveSideSummary; participants: LiveMatchParticipant[] },
  time: number,
): NewEventInsert[] {
  const events: NewEventInsert[] = [];
  const base = (overrides: Partial<NewEventInsert>): NewEventInsert => ({
    match_id: matchId,
    event_type: "tower",
    side: null,
    team_id: null,
    killer_summoner_name: null,
    killer_champion_id: null,
    victim_summoner_name: null,
    victim_champion_id: null,
    dragon_type: null,
    game_clock_seconds: time,
    ...overrides,
  });

  (["blue", "red"] as const).forEach((s) => {
    const before = s === "blue"
      ? { towers: cursor.blue_towers, barons: cursor.blue_barons, inhibitors: cursor.blue_inhibitors, dragonTypes: cursor.blue_dragon_types }
      : { towers: cursor.red_towers, barons: cursor.red_barons, inhibitors: cursor.red_inhibitors, dragonTypes: cursor.red_dragon_types };
    const after = snapshot[s];

    for (let i = 0; i < after.towers - before.towers; i += 1) {
      events.push(base({ event_type: "tower", side: s, team_id: after.teamId }));
    }
    for (let i = 0; i < after.barons - before.barons; i += 1) {
      events.push(base({ event_type: "baron", side: s, team_id: after.teamId }));
    }
    for (let i = 0; i < after.inhibitors - before.inhibitors; i += 1) {
      events.push(base({ event_type: "inhibitor", side: s, team_id: after.teamId }));
    }
    for (const dragonType of after.dragonTypes.slice(before.dragonTypes.length)) {
      events.push(base({ event_type: "dragon", side: s, team_id: after.teamId, dragon_type: dragonType }));
    }
  });

  // 킬러/빅텀은 절대 같은 팀일 수 없다 — 팀별로 모아서 반대편 팀끼리만 짝짓는다.
  const prevStats = cursor.participant_stats ?? {};
  const killersBySide: Record<Side, LiveMatchParticipant[]> = { blue: [], red: [] };
  const victimsBySide: Record<Side, LiveMatchParticipant[]> = { blue: [], red: [] };
  for (const participant of snapshot.participants) {
    const before = prevStats[participantKey(participant.side, participant.summonerName)];
    if (!before) continue;
    for (let i = 0; i < participant.kills - before.kills; i += 1) killersBySide[participant.side].push(participant);
    for (let i = 0; i < participant.deaths - before.deaths; i += 1) victimsBySide[participant.side].push(participant);
  }
  const opposite: Record<Side, Side> = { blue: "red", red: "blue" };
  (["blue", "red"] as const).forEach((killerSide) => {
    const killers = killersBySide[killerSide];
    const victims = victimsBySide[opposite[killerSide]];
    const count = Math.max(killers.length, victims.length);
    for (let i = 0; i < count; i += 1) {
      events.push(base({
        event_type: "kill",
        killer_summoner_name: killers[i]?.summonerName ?? null,
        killer_champion_id: killers[i]?.championId ?? null,
        victim_summoner_name: victims[i]?.summonerName ?? null,
        victim_champion_id: victims[i]?.championId ?? null,
      }));
    }
  });

  return events;
}

function buildParticipantStats(participants: LiveMatchParticipant[]) {
  const map: CursorRow["participant_stats"] = {};
  for (const participant of participants) {
    map[participantKey(participant.side, participant.summonerName)] = {
      kills: participant.kills,
      deaths: participant.deaths,
      championId: participant.championId,
    };
  }
  return map;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ matchId: string }> },
): Promise<NextResponse<LiveMatchResponse>> {
  const { matchId } = await context.params;
  const match = await getMatchById(matchId);
  if (!match) return NextResponse.json({ status: "not_found" }, { status: 404 });

  const supabase = createSupabaseAdminClient();

  // 우리 DB에서 이미 완료로 확정된 매치는 외부 API를 칠 필요 없이 라이브 잔여 데이터만
  // 정리하고 끝낸다 — 이 시점부턴 "타임라인" 탭의 공식 데이터가 이 자리를 대신한다.
  if (match.status === "completed") {
    await supabase.from("live_match_cursors").delete().eq("match_id", match.id);
    await supabase.from("live_match_events").delete().eq("match_id", match.id);
    return NextResponse.json({ status: "ended", events: [] });
  }

  const teams = await getAllTeams();
  const teamA = teams.find((team) => team.id === match.teamAId);
  const teamB = teams.find((team) => team.id === match.teamBId);
  if (!teamA || !teamB) return NextResponse.json({ status: "unavailable" });

  try {
    const matchDate = new Date(match.matchDate);
    if (Number.isNaN(matchDate.getTime())) return NextResponse.json({ status: "unavailable" });

    const scheduleEvents = await fetchTrackedLolesportsEvents({
      start: new Date(matchDate.getTime() - 3 * 60 * 60 * 1000),
      end: new Date(matchDate.getTime() + 10 * 60 * 60 * 1000),
    });

    const aligned = findLolesportsMatch(
      {
        id: match.id,
        matchDate: match.matchDate,
        lolesportsMatchId: match.lolesportsMatchId ?? null,
        teamA: { id: teamA.id, name: teamA.name, shortName: teamA.shortName },
        teamB: { id: teamB.id, name: teamB.name, shortName: teamB.shortName },
      },
      scheduleEvents,
    );
    if (!aligned) return NextResponse.json({ status: "unavailable" });

    const liveGame = aligned.event.match?.games?.find((game) => game?.state === "inProgress");
    const liveGameId = liveGame?.id;

    const { data: existingCursor } = await supabase
      .from("live_match_cursors")
      .select("*")
      .eq("match_id", match.id)
      .maybeSingle();
    let cursorRow = existingCursor as CursorRow | null;

    // 다음 세트가 실제로 시작된(=새 게임 ID가 라이브로 잡힌) 경우에만 이전 세트의
    // 라이브 데이터를 지운다. liveGameId가 없어진 것만으로는(방금 세트가 끝났거나
    // 세트 사이 휴식) 아직 안 지운다 — 그러면 "넥서스 부서짐" 순간을 보여줄 새도 없이
    // 곧바로 화면이 텅 비어버린다.
    if (cursorRow && liveGameId && cursorRow.lolesports_game_id !== liveGameId) {
      await supabase.from("live_match_events").delete().eq("match_id", match.id);
      await supabase.from("live_match_cursors").delete().eq("match_id", match.id);
      cursorRow = null;
    }

    if (!liveGameId) {
      // 라이브인 세트가 없다 — 이 세트가 방금 끝났다면(커서가 아직 남아있다면) 종료
      // 마커를 한 번 남긴다. 커서는 지우지 않고 그대로 둬서, 다음 세트가 시작될 때
      // "게임 ID가 바뀌었다"는 걸 감지해 그때 비로소 정리할 수 있게 한다.
      if (cursorRow) {
        const { data: existingEnd } = await supabase
          .from("live_match_events")
          .select("id")
          .eq("match_id", match.id)
          .eq("event_type", "end")
          .maybeSingle();
        if (!existingEnd) {
          await supabase.from("live_match_events").insert({
            match_id: match.id,
            event_type: "end",
            game_clock_seconds: cursorRow.duration_seconds ?? 0,
          });
        }
      }
      const events = await loadEvents(supabase, match.id);
      return NextResponse.json({ status: aligned.state === "completed" ? "ended" : "not_started", events });
    }

    const gameData = await withRetry(() => fetchLolesportsGameData(liveGameId));

    const blueIsTeamA = gameData.blueTeamMetadata?.esportsTeamId
      ? gameData.blueTeamMetadata.esportsTeamId === aligned.externalTeamAId
      : true; // 매핑 정보가 없으면 관례대로 teamA=블루로 가정한다.
    const blueTeamId = blueIsTeamA ? teamA.id : teamB.id;
    const redTeamId = blueIsTeamA ? teamB.id : teamA.id;

    const blue = side(gameData.blueTeam, blueTeamId);
    blue.kills = gameData.blueTeam?.totalKills ?? 0;
    blue.towers = gameData.blueTeam?.towers ?? 0;
    blue.barons = gameData.blueTeam?.barons ?? 0;
    blue.inhibitors = gameData.blueTeam?.inhibitors ?? 0;
    blue.dragonTypes = (gameData.blueTeam?.dragons ?? []).filter((value): value is string => Boolean(value));

    const red = side(gameData.redTeam, redTeamId);
    red.kills = gameData.redTeam?.totalKills ?? 0;
    red.towers = gameData.redTeam?.towers ?? 0;
    red.barons = gameData.redTeam?.barons ?? 0;
    red.inhibitors = gameData.redTeam?.inhibitors ?? 0;
    red.dragonTypes = (gameData.redTeam?.dragons ?? []).filter((value): value is string => Boolean(value));

    const participants: LiveMatchParticipant[] = gameData.participants.map((participant) => ({
      side: participant.side,
      summonerName: participant.metadata.summonerName ?? null,
      championId: participant.metadata.championId ?? null,
      kills: participant.window?.kills ?? 0,
      deaths: participant.window?.deaths ?? 0,
      assists: participant.window?.assists ?? 0,
    }));

    if (cursorRow) {
      const newEvents = buildNewEvents(match.id, cursorRow, { blue, red, participants }, gameData.durationSeconds ?? 0);
      if (newEvents.length > 0) {
        await supabase.from("live_match_events").insert(newEvents);
      }
    }

    await supabase.from("live_match_cursors").upsert({
      match_id: match.id,
      lolesports_game_id: liveGameId,
      blue_team_id: blueTeamId,
      red_team_id: redTeamId,
      blue_towers: blue.towers,
      red_towers: red.towers,
      blue_barons: blue.barons,
      red_barons: red.barons,
      blue_inhibitors: blue.inhibitors,
      red_inhibitors: red.inhibitors,
      blue_dragon_types: blue.dragonTypes,
      red_dragon_types: red.dragonTypes,
      participant_stats: buildParticipantStats(participants),
      duration_seconds: gameData.durationSeconds,
      updated_at: new Date().toISOString(),
    });

    const events = await loadEvents(supabase, match.id);

    return NextResponse.json({
      status: "live",
      durationSeconds: gameData.durationSeconds,
      blue,
      red,
      participants,
      events,
    });
  } catch {
    return NextResponse.json({ status: "unavailable" });
  }
}
