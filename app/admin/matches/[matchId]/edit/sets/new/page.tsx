import { notFound } from "next/navigation";

import { getMatchById, getMatches, getTeams } from "@/lib/data/lck";
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

  const [matches, teams] = await Promise.all([getMatches(), getTeams()]);
  const adminMatchPath = `/admin/matches/${matchRouteId(match)}/edit`;

  return (
    <AdminSetEditor
      title={`${teamLabel(teams, match.teamAId)} vs ${teamLabel(teams, match.teamBId)} 세트 추가`}
      match={match}
      teams={teams}
      matches={matches}
      adminMatchPath={adminMatchPath}
      action={createSetAction}
      submitLabel="세트 생성"
    />
  );
}
