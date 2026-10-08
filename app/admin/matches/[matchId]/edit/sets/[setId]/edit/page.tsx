import { notFound } from "next/navigation";

import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getAdminSetRatings,
  getMatchById,
  getPlayerStatLines,
  getSetById,
  getSetDataCompletionBySetId,
  getSetPicksBans,
  getSetsByMatchId,
} from "@/lib/data/lck";
import { fetchItemCatalog } from "@/lib/items";
import { fetchRuneCatalog } from "@/lib/runes";
import { fetchSpellCatalog } from "@/lib/spells";
import { ddragonVersionFromPatch } from "@/lib/ddragon";
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

  const itemVersion = ddragonVersionFromPatch(set.patch);
  const [teams, players, champions, picksBans, playerStatLines, fanRatings, matchSets, items, spells, runeCatalog, completionBySet] =
    await Promise.all([
      getAllTeams(),
      getAllPlayers(),
      getChampions(),
      getSetPicksBans(set.id),
      getPlayerStatLines(set.id),
      getAdminSetRatings(set.id),
      getSetsByMatchId(match.id),
      fetchItemCatalog(itemVersion),
      fetchSpellCatalog(itemVersion),
      fetchRuneCatalog(itemVersion),
      getSetDataCompletionBySetId([set.id]),
    ]);
  const completion = completionBySet.get(set.id);
  const adminMatchPath = `/admin/matches/${matchRouteId(match)}/edit`;

  return (
    <AdminSetEditor
      title={`${teamLabel(teams, match.teamAId)} vs ${teamLabel(teams, match.teamBId)} Set ${set.setNumber} Edit`}
      match={match}
      set={set}
      teams={teams}
      adminMatchPath={adminMatchPath}
      action={updateSetAction}
      submitLabel="Save set"
      players={players}
      champions={champions}
      items={items}
      spells={spells}
      runeCatalog={runeCatalog}
      itemVersion={itemVersion}
      picksBans={picksBans}
      playerStatLines={playerStatLines}
      fanRatings={fanRatings}
      matchSets={matchSets}
      timelineEventCount={completion?.timelineEventCount ?? 0}
    />
  );
}
