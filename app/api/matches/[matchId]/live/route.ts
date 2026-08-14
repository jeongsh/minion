import { NextResponse } from "next/server";

import { getAllTeams, getMatchById } from "@/lib/data/lck";
import { fetchLolesportsGameData, LiveGameUnavailableError } from "@/lib/lolesports-game-data";
import { fetchTrackedLolesportsEvents } from "@/lib/lolesports";
import { findLolesportsMatch } from "@/lib/lolesports-match-matcher";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// revalidate 기반 캐싱은 dev 서버에서 코드를 수정한 뒤에도 예전 실행 결과를 계속
// 서빙하는 것처럼 보이는 경우가 있었다(블루/레드 팀 배정을 고쳤는데도 실제 저장은
// 계속 예전 값으로 되는 문제로 발견됨). 이 라우트는 DB 쓰기라는 부작용이 있어서
// 캐시가 코드 변경을 못 따라가면 디버깅이 사실상 불가능해지므로, 매번 확실하게
// 새로 실행되도록 캐싱을 끈다. 동시 요청으로 인한 중복 저장은 dedupe_key
// 유니크 인덱스가 막아준다.
export const dynamic = "force-dynamic";

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
  dedupe_key: string;
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

// 세트가 끝난 시점(라이브 데이터가 더 이상 없음)을 발견한 곳마다 한 번씩 종료
// 마커를 남긴다 — dedupe_key가 게임ID에 묶여 있어 여러 지점에서 중복 호출해도 안전하다.
async function insertEndMarker(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  matchId: string,
  cursor: Pick<CursorRow, "duration_seconds" | "lolesports_game_id">,
) {
  const { error } = await supabase.from("live_match_events").upsert(
    {
      match_id: matchId,
      event_type: "end",
      game_clock_seconds: cursor.duration_seconds ?? 0,
      dedupe_key: `${matchId}:end:${cursor.lolesports_game_id}`,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
  if (error) console.error("live match end-event upsert failed", error);
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
  // 같은 diff(같은 cursor → 같은 snapshot)를 두 요청이 동시에 계산해도 항상 같은
  // dedupe_key가 나오게 한다 — cursor가 갖고 있던 "직전" duration을 기준점으로 쓰고,
  // 한 배치 안에서 내용이 같은 이벤트가 여러 개면(예: 타워 2개) 순번을 더한다.
  let sequence = 0;
  const base = (overrides: Partial<Omit<NewEventInsert, "dedupe_key">>): NewEventInsert => {
    const draft = {
      match_id: matchId,
      event_type: "tower" as const,
      side: null,
      team_id: null,
      killer_summoner_name: null,
      killer_champion_id: null,
      victim_summoner_name: null,
      victim_champion_id: null,
      dragon_type: null,
      game_clock_seconds: time,
      ...overrides,
    };
    const key = [
      matchId,
      cursor.duration_seconds ?? "x",
      draft.event_type,
      draft.side ?? "",
      draft.killer_summoner_name ?? "",
      draft.victim_summoner_name ?? "",
      draft.dragon_type ?? "",
      sequence++,
    ].join(":");
    return { ...draft, dedupe_key: key };
  };

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

  // 우리 DB에서 이미 완료로 확정된 매치는 외부 API를 칠 필요가 없다 — 이 시점부턴
  // "타임라인" 탭의 공식 데이터가 이 자리를 대신한다. 다만 커서가 아직 남아있다면
  // (=완료 확정 직후 첫 요청) 곧바로 다 지우지 않고 종료 마커를 한 번 남긴 뒤 커서만
  // 지운다 — 그래야 마지막 순간이 화면에 뜰 새도 없이 사라지지 않는다. 이벤트 자체는
  // 그다음 요청(커서가 이미 없는 상태)에서 정리한다.
  if (match.status === "completed") {
    const { data: cursorRow } = await supabase
      .from("live_match_cursors")
      .select("duration_seconds, lolesports_game_id")
      .eq("match_id", match.id)
      .maybeSingle();

    if (cursorRow) {
      await insertEndMarker(supabase, match.id, cursorRow);
      await supabase.from("live_match_cursors").delete().eq("match_id", match.id);
      const events = await loadEvents(supabase, match.id);
      return NextResponse.json({ status: "ended", events });
    }

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

    if (!liveGameId) {
      // 라이브인 세트가 없다 — 이 세트가 방금 끝났다면(커서가 아직 남아있다면) 종료
      // 마커를 한 번 남긴다. 커서는 지우지 않고 그대로 둬서, 다음 세트가 시작될 때
      // "게임 ID가 바뀌었다"는 걸 감지해 그때 비로소 정리할 수 있게 한다.
      if (cursorRow) await insertEndMarker(supabase, match.id, cursorRow);
      const events = await loadEvents(supabase, match.id);
      return NextResponse.json({ status: aligned.state === "completed" ? "ended" : "not_started", events });
    }

    let gameData;
    try {
      gameData = await withRetry(() => fetchLolesportsGameData(liveGameId));
    } catch (error) {
      // 스케줄 API는 아직 이 세트를 inProgress로 보고 있지만, 라이브 스탯 쪽은 이미
      // 이 게임ID에 대한 데이터를 완전히 내렸다 — 세트가 실제로는 끝났다는 뜻이다.
      // liveGameId가 아예 사라졌을 때와 동일하게 취급해 "unavailable"로 떨어뜨리는
      // 대신 종료 마커를 남긴다.
      if (error instanceof LiveGameUnavailableError) {
        if (cursorRow) await insertEndMarker(supabase, match.id, cursorRow);
        const events = await loadEvents(supabase, match.id);
        return NextResponse.json({ status: aligned.state === "completed" ? "ended" : "not_started", events });
      }
      throw error;
    }

    // 다음 세트가 실제로 시작된(=새 게임 ID의 라이브 데이터를 성공적으로 받아온) 경우에만
    // 이전 세트의 라이브 데이터를 지운다. fetch 성공 "전에" 지우면, 막 시작한 세트는
    // 라이엇 라이브 스탯이 몇 초간 아직 안 올라와 요청이 실패하는 일이 흔한데 그때
    // catch로 빠지면서 이전 세트 기록만 날리고 아무것도 새로 못 채우는 사고가 난다 —
    // 실제로 이 경합 때문에 넥서스가 부서지는 마지막 순간이 통째로 유실된 적이 있었다.
    if (cursorRow && cursorRow.lolesports_game_id !== liveGameId) {
      await supabase.from("live_match_events").delete().eq("match_id", match.id);
      await insertEndMarker(supabase, match.id, cursorRow);
      cursorRow = null;
    }

    // blueTeamMetadata.esportsTeamId와 aligned.externalTeamAId는 서로 다른 API(라이브
    // 스탯 feed vs 스케줄 GraphQL)가 각자 매기는 팀 ID라 네임스페이스가 항상 같다는
    // 보장이 없다 — 실제로 세트 도중 이 비교가 틀려서 블루/레드가 뒤바뀐 채 저장된 적이
    // 있었다. 소환사명 접두어("GEN Kiin"처럼 팀 코드로 시작)로 판별하는 게 훨씬 믿을만한
    // 신호인데, 선수 1명만 보면 그 한 명의 이름 표기가 흔들릴 때 여전히 틀릴 수 있어서
    // 블루 쪽 5명 전체를 보고 다수결로 판단한다.
    const startsWithShortName = (name: string | null | undefined, shortName: string) =>
      Boolean(name && shortName && name.trim().toUpperCase().startsWith(shortName.trim().toUpperCase()));
    const blueNames = (gameData.blueTeamMetadata?.participantMetadata ?? [])
      .map((participant) => participant?.summonerName)
      .filter((name): name is string => Boolean(name));
    const blueMatchesTeamA = blueNames.filter((name) => startsWithShortName(name, teamA.shortName)).length;
    const blueMatchesTeamB = blueNames.filter((name) => startsWithShortName(name, teamB.shortName)).length;
    const blueIsTeamA = blueMatchesTeamA !== blueMatchesTeamB
      ? blueMatchesTeamA > blueMatchesTeamB
      : gameData.blueTeamMetadata?.esportsTeamId
        ? gameData.blueTeamMetadata.esportsTeamId === aligned.externalTeamAId
        : true; // 이름으로도 못 가르면 관례대로 teamA=블루로 가정한다.
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
        const { error: eventsInsertError } = await supabase
          .from("live_match_events")
          .upsert(newEvents, { onConflict: "dedupe_key", ignoreDuplicates: true });
        if (eventsInsertError) console.error("live match events upsert failed", eventsInsertError);
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
