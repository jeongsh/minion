import { notFound } from "next/navigation";

import { FanVideoFeed } from "@/components/fan/fan-video-feed";
import { FanPageShell } from "@/components/fan/fan-page-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  getFanVideoFeed,
  getPlayers,
  getTeamByFanSiteHost,
  getTeamBySlug,
} from "@/lib/data/lck";
import { buildFanVideoItems } from "@/lib/fan-video-items";

export const dynamic = "force-dynamic";

export default async function FanVideosPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) notFound();

  const players = (await getPlayers())
    .filter((player) => player.teamId === team.id)
    .sort((first, second) => first.name.localeCompare(second.name));
  const feed = await getFanVideoFeed(team.id, players.map((player) => player.id));
  const videos = buildFanVideoItems({
    team,
    players,
    teamVideos: feed.teamVideos,
    playerVideos: feed.playerVideos,
  });

  return (
    <FanPageShell
      eyebrow={`${team.shortName} YouTube`}
      title="영상"
      description="구단 공식 영상과 현재 소속 선수 영상을 함께 봅니다."
    >
      <Breadcrumb items={[{ label: team.shortName, href: `/fan/${teamSlug}` }, { label: "영상" }]} />

      <FanVideoFeed teamSlug={team.fanSiteHost} teamName={team.shortName} videos={videos} />
    </FanPageShell>
  );
}
