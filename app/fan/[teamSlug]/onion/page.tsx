import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { FanOnionBoard } from "@/components/fan/fan-onion-board";
import { FanPageShell, FanSubpageHeader } from "@/components/fan/fan-page-shell";
import { getActiveFanOnions, getFanTemperatureSnapshot } from "@/lib/data/fan-pulse";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export const dynamic = "force-dynamic";

export default async function FanOnionPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  const [onions, snapshot] = await Promise.all([
    getActiveFanOnions(team.id),
    getFanTemperatureSnapshot(team.id),
  ]);

  return (
    <FanPageShell>
      <div style={{ "--team-primary": team.primaryColor } as CSSProperties}>
        <FanSubpageHeader
          title="비난양파"
          breadcrumbs={[{ label: team.shortName, href: `/fan/${teamSlug}` }, { label: "비난양파" }]}
        />
        <div className="mt-6">
        <FanOnionBoard
          teamId={team.id}
          teamSlug={team.fanSiteHost}
          teamName={team.shortName}
          teamColor={team.primaryColor}
          initialOnions={onions}
          initialSnapshot={snapshot}
        />
        </div>
      </div>
    </FanPageShell>
  );
}
