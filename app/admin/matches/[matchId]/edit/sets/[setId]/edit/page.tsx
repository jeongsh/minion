import { notFound } from "next/navigation";

import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getFanRatings,
  getMatchById,
  getMatches,
  getPlayerStatLines,
  getSetById,
  getSetPicksBans,
  getSetsByMatchId,
} from "@/lib/data/lck";
import { fetchItemCatalog } from "@/lib/items";
import { matchRouteId, teamLabel } from "@/lib/view-data";

import { updateSetAction } from "../../../../../../sets/actions";
import { AdminSetEditor } from "../../set-editor";

export default async function AdminMatchSetEditPage({
  params,
}: {
  params: Promise<{ matchId: string; setId: string }>;
}) {
  const { matchId, setId } = await params;
  const [match, set] = await Promise.all([getMatchById(matchId), getSetById(setId)]);

  if (!match || !set || set.matchId !== match.id) {
    notFound();
  }

  const [matches, teams, players, champions, picksBans, playerStatLines, fanRatings, matchSets] =
    await Promise.all([
      getMatches(),
      getAllTeams(),
      getAllPlayers(),
      getChampions(),
      getSetPicksBans(set.id),
      getPlayerStatLines(set.id),
      getFanRatings(),
      getSetsByMatchId(match.id),
    ]);
  const itemVersion = champions.find((champion) => champion.ddragonVersion)?.ddragonVersion ?? "16.12.1";
  const items = await fetchItemCatalog(itemVersion);
  const adminMatchPath = `/admin/matches/${matchRouteId(match)}/edit`;

  return (
    <AdminSetEditor
      title={`${teamLabel(teams, match.teamAId)} vs ${teamLabel(teams, match.teamBId)} Set ${set.setNumber} Edit`}
      match={match}
      set={set}
      teams={teams}
      matches={matches}
      adminMatchPath={adminMatchPath}
      action={updateSetAction}
      submitLabel="Save set"
      players={players}
      champions={champions}
      items={items}
      itemVersion={itemVersion}
      picksBans={picksBans}
      playerStatLines={playerStatLines}
      fanRatings={fanRatings}
      matchSets={matchSets}
    />
  );
}
