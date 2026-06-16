import { notFound } from "next/navigation";

import {
  getChampions,
  getFanRatings,
  getMatchById,
  getMatches,
  getPlayerStatLines,
  getPlayers,
  getSetById,
  getSetPicksBans,
  getSetsByMatchId,
  getTeams,
} from "@/lib/data/lck";
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
      getTeams(),
      getPlayers(),
      getChampions(),
      getSetPicksBans(set.id),
      getPlayerStatLines(set.id),
      getFanRatings(),
      getSetsByMatchId(match.id),
    ]);
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
      picksBans={picksBans}
      playerStatLines={playerStatLines}
      fanRatings={fanRatings}
      matchSets={matchSets}
    />
  );
}
