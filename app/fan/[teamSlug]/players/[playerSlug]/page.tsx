import { notFound } from "next/navigation";

import { PlayerDetailView } from "@/app/players/[playerSlug]/player-detail-view";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export default async function FanPlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string; playerSlug: string }>;
  searchParams: Promise<{ segment?: string }>;
}) {
  const [{ teamSlug, playerSlug }, query] = await Promise.all([params, searchParams]);
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const playersBase = `/fan/${teamSlug}/players`;

  return (
    <PlayerDetailView
      playerSlug={playerSlug}
      segment={query.segment}
      linkBase={playersBase}
      breadcrumbLead={[
        { label: team.shortName, href: `/fan/${teamSlug}` },
        { label: "선수", href: playersBase },
      ]}
    />
  );
}
