import { NextResponse } from "next/server";

import { getAllTeams, getMatchById } from "@/lib/data/lck";
import { fetchLolesportsGameData } from "@/lib/lolesports-game-data";
import { fetchTrackedLolesportsEvents } from "@/lib/lolesports";
import { findLolesportsMatch } from "@/lib/lolesports-match-matcher";

export const runtime = "nodejs";
// 여러 명이 동시에 폴링해도 이 창 안에서는 캐시된 응답 하나만 재사용해서, 우리 서버가
// feed.lolesports.com/esports-api를 매 요청마다 다시 두드리지 않게 한다.
export const revalidate = 8;

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
  side: "blue" | "red";
  summonerName: string | null;
  championId: string | null;
  kills: number;
  deaths: number;
  assists: number;
};

export type LiveMatchResponse =
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "not_started" }
  | { status: "ended" }
  | {
      status: "live";
      durationSeconds: number | null;
      blue: LiveSideSummary;
      red: LiveSideSummary;
      participants: LiveMatchParticipant[];
    };

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ matchId: string }> },
): Promise<NextResponse<LiveMatchResponse>> {
  const { matchId } = await context.params;
  const match = await getMatchById(matchId);
  if (!match) return NextResponse.json({ status: "not_found" }, { status: 404 });

  const teams = await getAllTeams();
  const teamA = teams.find((team) => team.id === match.teamAId);
  const teamB = teams.find((team) => team.id === match.teamBId);
  if (!teamA || !teamB) return NextResponse.json({ status: "unavailable" });

  try {
    const matchDate = new Date(match.matchDate);
    if (Number.isNaN(matchDate.getTime())) return NextResponse.json({ status: "unavailable" });

    const events = await fetchTrackedLolesportsEvents({
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
      events,
    );
    if (!aligned) return NextResponse.json({ status: "unavailable" });

    const liveGame = aligned.event.match?.games?.find((game) => game?.state === "inProgress");
    if (!liveGame?.id) {
      return NextResponse.json({ status: aligned.state === "completed" ? "ended" : "not_started" });
    }

    const gameData = await fetchLolesportsGameData(liveGame.id);

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

    return NextResponse.json({
      status: "live",
      durationSeconds: gameData.durationSeconds,
      blue,
      red,
      participants,
    });
  } catch {
    return NextResponse.json({ status: "unavailable" });
  }
}
