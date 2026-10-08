import { notFound } from "next/navigation";

import { getAllTeams, getChampions, getMatchById } from "@/lib/data/lck";
import { DEFAULT_DDRAGON_VERSION } from "@/lib/ddragon";
import { fetchItemCatalog } from "@/lib/items";
import { fetchRuneCatalog } from "@/lib/runes";
import { fetchSpellCatalog } from "@/lib/spells";
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

  const itemVersion = DEFAULT_DDRAGON_VERSION;
  const [teams, champions, items, spells, runeCatalog] = await Promise.all([
    getAllTeams(),
    getChampions(),
    fetchItemCatalog(itemVersion),
    fetchSpellCatalog(itemVersion),
    fetchRuneCatalog(itemVersion),
  ]);
  const adminMatchPath = `/admin/matches/${matchRouteId(match)}/edit`;

  return (
    <AdminSetEditor
      title={`${teamLabel(teams, match.teamAId)} vs ${teamLabel(teams, match.teamBId)} 세트 추가`}
      match={match}
      teams={teams}
      champions={champions}
      items={items}
      spells={spells}
      runeCatalog={runeCatalog}
      itemVersion={itemVersion}
      adminMatchPath={adminMatchPath}
      action={createSetAction}
      submitLabel="세트 생성"
    />
  );
}
