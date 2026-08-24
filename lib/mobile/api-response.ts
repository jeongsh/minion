import { NextResponse } from "next/server";

import type {
  MobileApiError,
  MobileApiSuccess,
  MobileBracketMatch,
  MobileChampionRef,
  MobileMatchSummary,
  MobileObjectiveCounts,
  MobilePlayerLoadout,
  MobilePlayerSummary,
  MobileSetDraftSide,
  MobileSetPlayerStat,
  MobileStandingRow,
  MobileTeamSummary,
  MobileTimelineEvent,
  MobileTimelineFrame,
  MobileTournamentSummary,
} from "@/packages/contracts/src/mobile-v1";
import type { buildTeamStandingRows } from "@/lib/view-data";
import type { Match, Player, PlayerStatLine, SetPickBan, SetResult, Team, Tournament, Champion } from "@/lib/types";
import type { TimelineEvent, MatchTimelineFrame } from "@/lib/data/lck";
import { championImage, championLabel } from "@/lib/champions";
import { itemImageUrl } from "@/lib/items";
import {
  baronIconsForSide,
  dragonIconsForSide,
  elderIconsForSide,
  heraldIconsForSide,
  voidGrubIconsForSide,
} from "@/lib/objectives";
import { spellImageUrlById, type GameSpell } from "@/lib/spells";
import { resolveRunePairUrls, type RuneCatalog } from "@/lib/runes";
import { calculatePlayerStats } from "@/lib/stats";

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
  return { category: tournament.category, id: tournament.id, league: tournament.league ?? null, name: tournament.name, season: tournament.season, split: tournament.split ?? null };
}

export function toMobilePlayer(player: Player): MobilePlayerSummary {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    profileImage: player.profileImageUrl ? { url: player.profileImageUrl } : null,
    slug: player.slug,
    teamId: player.teamId,
  };
}

export function toMobileStandingRow(row: ReturnType<typeof buildTeamStandingRows>[number]): MobileStandingRow {
  return {
    matchLosses: row.matchLosses,
    matchWins: row.matchWins,
    rank: row.rank,
    setDiff: row.setDiff,
    team: toMobileTeam(row.team),
    winRate: row.winRate,
  };
}

export function toMobileBracketMatch(match: Match, teams: Map<string, Team>): MobileBracketMatch {
  return {
    id: match.id,
    matchDate: match.matchDate,
    status: match.status,
    teamA: teams.get(match.teamAId) ? toMobileTeam(teams.get(match.teamAId)!) : null,
    teamAScore: match.teamAScore,
    teamB: teams.get(match.teamBId) ? toMobileTeam(teams.get(match.teamBId)!) : null,
    teamBScore: match.teamBScore,
    winnerTeamId: match.winnerTeamId ?? null,
  };
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

export function toMobileChampionRef(champion: Champion | undefined): MobileChampionRef {
  const image = championImage(champion);
  return { id: champion?.id ?? null, image: image ? { url: image } : null, name: championLabel(champion) };
}

export function toMobileObjectiveCounts(set: SetResult, side: "blue" | "red"): MobileObjectiveCounts {
  return {
    barons: baronIconsForSide(set, side).length,
    dragons: dragonIconsForSide(set, side, { includeElder: false }).length,
    elders: elderIconsForSide(set, side).length,
    heralds: heraldIconsForSide(set, side).length,
    towers: Math.max(0, (side === "blue" ? set.blueTowers : set.redTowers) ?? 0),
    voidGrubs: voidGrubIconsForSide(set, side).length,
  };
}

export function toMobileSetDraftSide(
  teamId: string,
  teamName: string,
  bans: SetPickBan[],
  champions: Champion[],
): MobileSetDraftSide {
  const sorted = [...bans].sort((a, b) => a.orderIndex - b.orderIndex);
  const slots = Array.from({ length: 5 }, (_, index) => {
    const item = sorted[index];
    if (!item) return null;
    return toMobileChampionRef(champions.find((champion) => champion.id === item.championId));
  });
  return { bans: slots, teamId, teamName };
}

function hasRegularItem(itemId: number | null | undefined): itemId is number {
  return itemId != null && itemId > 0 && (itemId < 1200 || itemId >= 2000);
}

function compactItemImageSlots(itemIds: Array<number | null | undefined>, version: string) {
  const items = itemIds.slice(0, 6).filter(hasRegularItem);
  const padded = [...items, ...Array<number | null>(6).fill(null)].slice(0, 6);
  return padded.map((itemId) => (itemId ? { url: itemImageUrl(itemId, version) } : null));
}

export function toMobilePlayerLoadout(
  line: PlayerStatLine,
  champions: Champion[],
  spells: GameSpell[],
  version: string,
  runeCatalog: RuneCatalog,
): MobilePlayerLoadout {
  const champion = champions.find((item) => item.id === line.championId);
  const { keystoneUrl, treeUrl } = resolveRunePairUrls(line.runeIds, runeCatalog);
  const trinketId = line.itemIds[6] ?? null;
  return {
    champion: toMobileChampionRef(champion),
    itemImages: compactItemImageSlots(line.itemIds, version),
    roleBoundItemImage: line.roleBoundItem ? { url: itemImageUrl(line.roleBoundItem, version) } : null,
    runeImages: [keystoneUrl ? { url: keystoneUrl } : null, treeUrl ? { url: treeUrl } : null],
    spellImages: [0, 1].map((index) => {
      const url = spellImageUrlById(spells, line.spellIds[index], version);
      return url ? { url } : null;
    }),
    trinketImage: trinketId ? { url: itemImageUrl(trinketId, version) } : null,
  };
}

export function toMobileSetPlayerStat(
  line: PlayerStatLine,
  players: Player[],
  champions: Champion[],
  spells: GameSpell[],
  version: string,
  runeCatalog: RuneCatalog,
): MobileSetPlayerStat {
  const stats = calculatePlayerStats(line);
  return {
    assists: line.assists,
    championLevel: line.championLevel ?? null,
    cs: line.cs,
    csm: stats.csm,
    damage: line.damageToChampions,
    deaths: line.deaths,
    dpm: stats.dpm,
    gold: line.gold,
    kda: stats.kda,
    killParticipation: stats.kp,
    kills: line.kills,
    loadout: toMobilePlayerLoadout(line, champions, spells, version, runeCatalog),
    playerId: line.playerId,
    playerName: players.find((player) => player.id === line.playerId)?.name ?? "-",
    position: line.position,
    teamId: line.teamId,
    visionScore: line.visionScore,
  };
}

export function toMobileTimelineEvent(event: TimelineEvent): MobileTimelineEvent {
  return {
    assistPlayerIds: event.assistPlayerIds,
    buildingType: event.buildingType,
    eventType: event.eventType,
    id: event.id,
    killerPlayerId: event.killerPlayerId,
    laneType: event.laneType,
    monsterType: event.monsterType,
    teamId: event.teamId,
    timestampMs: event.timestampMs,
    victimPlayerId: event.victimPlayerId,
  };
}

export function toMobileTimelineFrame(frame: MatchTimelineFrame): MobileTimelineFrame {
  return {
    blueTotalGold: frame.blueTotalGold,
    goldDiff: frame.goldDiff,
    redTotalGold: frame.redTotalGold,
    timestampMs: frame.timestampMs,
  };
}
