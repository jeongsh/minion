import { notFound } from "next/navigation";

import { getAllTeams, getChampions, getMatchById, getMatches } from "@/lib/data/lck";
import { fetchItemCatalog } from "@/lib/items";
import { matchRouteId, teamLabel } from "@/lib/view-data";

import { createSetAction } from "../../../../../sets/actions";
import { AdminSetEditor } from "../set-editor";

export default async function AdminMatchSetCreatePage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const match = await getMatchById(matchId);

  if (!match) {
    notFound();
  }

  const [matches, teams, champions] = await Promise.all([getMatches(), getAllTeams(), getChampions()]);
  const itemVersion = champions.find((champion) => champion.ddragonVersion)?.ddragonVersion ?? "16.12.1";
  const items = await fetchItemCatalog(itemVersion);
  const adminMatchPath = `/admin/matches/${matchRouteId(match)}/edit`;

  return (
    <AdminSetEditor
      title={`${teamLabel(teams, match.teamAId)} vs ${teamLabel(teams, match.teamBId)} 세트 추가`}
      match={match}
      teams={teams}
      matches={matches}
      champions={champions}
      items={items}
      itemVersion={itemVersion}
      adminMatchPath={adminMatchPath}
      action={createSetAction}
      submitLabel="세트 생성"
    />
  );
}
