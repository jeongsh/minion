import { getMediaPage, getMediaTabs } from "@/lib/fan/media-feed";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PagedFanInstagramFeed } from "@/components/fan/fan-instagram-feed";
import { FanPageShell } from "@/components/fan/fan-page-shell";
import {
  getInstagramStories,
  getPlayers,
  getTeamByFanSiteHost,
  getTeamBySlug,
} from "@/lib/data/lck";

export const dynamic = "force-dynamic";

// 외부 인스타그램 임베드 피드라 색인 대상에서 제외한다.
export const metadata: Metadata = { title: "인스타그램", robots: { index: false } };

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
  const [initialPage, tabs, stories] = await Promise.all([
    getMediaPage(teamSlug, "instagram"),
    getMediaTabs(teamSlug, "instagram"),
    getInstagramStories(team.id, playerIds),
  ]);

  return (
    <FanPageShell>
      <h1 className="sr-only">인스타그램</h1>
      <PagedFanInstagramFeed
        key={team.id}
        teamSlug={team.fanSiteHost || teamSlug}
        teamName={team.shortName}
        teamLogoUrl={team.logoUrl}
        teamInstagramUrl={team.officialInstagramUrl}
        initialPage={initialPage}
        tabs={tabs}
        stories={stories}
        players={teamPlayers}
      />
    </FanPageShell>
  );
}
