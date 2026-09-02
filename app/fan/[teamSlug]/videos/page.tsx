import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FanVideoFeed } from "@/components/fan/fan-video-feed";
import { FanPageShell } from "@/components/fan/fan-page-shell";
import {
  getFanVideoFeed,
  getPlayers,
  getTeamByFanSiteHost,
  getTeamBySlug,
} from "@/lib/data/lck";
import { buildFanVideoItems } from "@/lib/fan-video-items";

export const dynamic = "force-dynamic";

// 외부 유튜브 임베드 위주라 색인 가치가 낮고 팀마다 내용이 겹친다. title만 부여하고 색인 제외.
export const metadata: Metadata = { title: "영상", robots: { index: false } };

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
    <FanPageShell>
      <h1 className="sr-only">영상</h1>
      <FanVideoFeed teamSlug={team.fanSiteHost} teamName={team.shortName} videos={videos} />
    </FanPageShell>
  );
}
