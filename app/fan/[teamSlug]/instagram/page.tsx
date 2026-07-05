import { notFound } from "next/navigation";

import { FanInstagramFeed } from "@/components/fan/fan-instagram-feed";
import { FanPageShell } from "@/components/fan/fan-page-shell";
import {
  getInstagramStories,
  getPlayers,
  getTeamByFanSiteHost,
  getTeamBySlug,
  getTeamInstagramFeed,
} from "@/lib/data/lck";

export const dynamic = "force-dynamic";

export default async function FanInstagramPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) notFound();

  const teamPlayers = (await getPlayers()).filter((player) => player.teamId === team.id);
  const playerIds = teamPlayers.map((player) => player.id);
  const [instagramFeed, stories] = await Promise.all([
    getTeamInstagramFeed(team.id, playerIds),
    getInstagramStories(team.id, playerIds),
  ]);

  return (
    <FanPageShell eyebrow={`${team.shortName} Instagram`} title="인스타그램">
      <FanInstagramFeed
        teamSlug={team.fanSiteHost}
        teamName={team.shortName}
        teamLogoUrl={team.logoUrl}
        teamInstagramUrl={team.officialInstagramUrl}
        teamPosts={instagramFeed.teamPosts}
        playerPosts={instagramFeed.playerPosts}
        stories={stories}
        players={teamPlayers}
      />
    </FanPageShell>
  );
}
