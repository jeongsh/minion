import { NextResponse } from "next/server";

import type {
  MobileApiError,
  MobileApiSuccess,
  MobileMatchSummary,
  MobileTeamSummary,
  MobileTournamentSummary,
} from "@/packages/contracts/src/mobile-v1";
import type { Match, Team, Tournament } from "@/lib/types";

export function mobileSuccess<T>(data: T, init?: ResponseInit) {
  const body: MobileApiSuccess<T> = {
    data,
    meta: { generatedAt: new Date().toISOString(), requestId: crypto.randomUUID(), version: "v1" },
  };
  const headers = new Headers(init?.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return NextResponse.json(body, { ...init, headers });
}

export function mobileError(code: MobileApiError["error"]["code"], message: string, status: number) {
  const body: MobileApiError = {
    error: { code, message },
    meta: { generatedAt: new Date().toISOString(), requestId: crypto.randomUUID(), version: "v1" },
  };
  return NextResponse.json(body, { headers: { "Access-Control-Allow-Origin": "*" }, status });
}

export function toMobileTeam(team: Team): MobileTeamSummary {
  return {
    id: team.id,
    fanSiteHost: team.fanSiteHost,
    isLckTeam: Boolean(team.isLckTeam),
    logo: team.logoUrl ? { url: team.logoUrl } : null,
    logoDark: team.logoWhiteUrl ? { url: team.logoWhiteUrl } : null,
    name: team.name,
    onPrimaryColor: "#ffffff",
    primaryColor: team.primaryColor,
    shortName: team.shortName,
    slug: team.slug,
    useWhiteLogoOnDark: Boolean(team.useWhiteLogoOnDark),
  };
}

export function toMobileTournament(tournament: Tournament): MobileTournamentSummary {
  return { id: tournament.id, league: tournament.league ?? null, name: tournament.name, season: tournament.season, split: tournament.split ?? null };
}

export function toMobileMatch(
  match: Match,
  teams: Map<string, Team>,
  tournaments: Map<string, Tournament>,
): MobileMatchSummary {
  return {
    bestOf: match.bestOf ?? null,
    id: match.id,
    name: match.name,
    startsAt: match.matchDate,
    status: match.status,
    teamA: teams.get(match.teamAId) ? toMobileTeam(teams.get(match.teamAId)!) : null,
    teamAScore: match.teamAScore,
    teamB: teams.get(match.teamBId) ? toMobileTeam(teams.get(match.teamBId)!) : null,
    teamBScore: match.teamBScore,
    tournament: tournaments.get(match.tournamentId) ? toMobileTournament(tournaments.get(match.tournamentId)!) : null,
    winnerTeamId: match.winnerTeamId ?? null,
  };
}
