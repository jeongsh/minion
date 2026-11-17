import "server-only";
import { getAllTeams, getChampions, getMatchesForScope, getPlayerBySlug, getPlayerSetRatingMetrics, getPlayerStatLines, getPlayersByIds, getSetsForMatches, getTournaments, type PlayerReviewCursor } from "@/lib/data/lck";
import { getPlayerFanPogSetIds } from "@/lib/data/player-cache";
import { createSupabaseServerClient, canQuerySupabase } from "@/lib/supabase/server";
import { parseSeasonSegment, tournamentsInSegment } from "@/lib/tournament-filters";
import { calculatePlayerStats } from "@/lib/stats";
import { ddragonVersionFromPatch, uniqueDdragonVersionsForPatches } from "@/lib/ddragon";
import { fetchSpellCatalog } from "@/lib/spells";
import { fetchRuneCatalog } from "@/lib/runes";
import { toMobilePlayerLoadout, toMobileTeam } from "@/lib/mobile/api-response";
import type { MobilePlayerRecentMatch } from "@/packages/contracts/src/mobile-v1";

export async function getPlayerHistoryPage(playerSlug: string, segment: string, cursor: PlayerReviewCursor | null = null, pageSize = 3) {
  const [player, tournaments] = await Promise.all([getPlayerBySlug(playerSlug), getTournaments()]);
  if (!player) return null;
  const tournamentIds = tournamentsInSegment(tournaments, segment === "all" ? "all" : parseSeasonSegment(segment)).map(item => item.id);
  const result = canQuerySupabase() && tournamentIds.length
    ? await createSupabaseServerClient().rpc("read_player_history_matches", {
      p_player_id: player.id, p_tournament_ids: tournamentIds, p_after_date: cursor?.createdAt ?? null, p_after_id: cursor?.id ?? null, p_limit: pageSize,
    }) : { data: [], error: null };
  if (result.error) throw result.error;
  const index = (result.data ?? []) as { match_id: string; match_date: string }[];
  const selected = index.slice(0, pageSize);
  const ids = selected.map(row => row.match_id);
  const [matches, sets, teams, champions] = await Promise.all([
    getMatchesForScope({ ids }), getSetsForMatches(ids), getAllTeams(), getChampions(),
  ]);
  const lines = await getPlayerStatLines(sets.filter(set => set.winnerTeamId).map(set => set.id), player.id);
  const playerSetIds = lines.map(line => line.setId);
  const versions = uniqueDdragonVersionsForPatches(sets.map(set => set.patch));
  const [ratings, pogIds, pomPlayers, assets] = await Promise.all([
    getPlayerSetRatingMetrics(player.id, playerSetIds), getPlayerFanPogSetIds(player.id, playerSetIds),
    getPlayersByIds(matches.flatMap(match => match.officialPomPlayerId ? [match.officialPomPlayerId] : [])),
    Promise.all(versions.map(async version => {
      const [spells, runes] = await Promise.all([fetchSpellCatalog(version), fetchRuneCatalog(version)]);
      return { version, spells, runes };
    })),
  ]);
  const rows = selected.flatMap(item => {
    const match = matches.find(match => match.id === item.match_id);
    if (!match) return [];
    const matchLines = lines.flatMap(line => {
      const set = sets.find(set => set.id === line.setId && set.matchId === match.id);
      if (!set) return [];
      const normalized = { ...line, teamKills: line.kills };
      return [{ ...normalized, set, match, stats: calculatePlayerStats(normalized) }];
    }).sort((a,b) => a.set.setNumber - b.set.setNumber);
    return [{
      match, lines: matchLines, ratings: ratings.filter(rating => rating.matchId === match.id),
      fanPog: matchLines.some(line => pogIds.includes(line.setId)),
      officialPomName: pomPlayers.find(item => item.id === match.officialPomPlayerId)?.name ?? "-",
    }];
  });
  const last = selected.at(-1);
  return {
    player, teams, champions, rows,
    spellsByVersion: Object.fromEntries(assets.map(asset => [asset.version, asset.spells])),
    runeCatalogByVersion: Object.fromEntries(assets.map(asset => [asset.version, asset.runes])),
    nextCursor: index.length > pageSize && last ? { createdAt: last.match_date, id: last.match_id } : null,
  };
}

export function mobilePlayerHistory(page: NonNullable<Awaited<ReturnType<typeof getPlayerHistoryPage>>>): MobilePlayerRecentMatch[] {
  return page.rows.map(row => {
    const { match, lines } = row;
    const playerTeamId = lines[0]?.teamId ?? page.player.teamId;
    const opponent = page.teams.find(team => team.id === (match.teamAId === playerTeamId ? match.teamBId : match.teamAId));
    return {
      id: match.id, name: match.name, startsAt: match.matchDate, playerTeamId,
      opponent: opponent ? toMobileTeam(opponent) : null, winnerTeamId: match.winnerTeamId ?? null,
      teamAScore: match.teamAScore, teamBScore: match.teamBScore, teamAId: match.teamAId, teamBId: match.teamBId,
      fanPog: row.fanPog, officialPomName: row.officialPomName,
      sets: lines.map(line => {
        const version = ddragonVersionFromPatch(line.set.patch);
        return {
          id: line.setId, setNumber: line.set.setNumber, rating: row.ratings.find(rating => rating.setId === line.setId)?.rating ?? null,
          championLevel: line.championLevel ?? null, kills: line.kills, deaths: line.deaths, assists: line.assists,
          kda: line.stats.kda, damage: line.damageToChampions, dpm: line.stats.dpm, visionScore: line.visionScore,
          cs: line.cs, csm: line.stats.csm, gold: line.gold,
          loadout: toMobilePlayerLoadout(line, page.champions, page.spellsByVersion[version] ?? [], version, page.runeCatalogByVersion[version] ?? { keystones: [], trees: [] }),
        };
      }),
    };
  });
}
