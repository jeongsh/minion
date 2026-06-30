import { notFound } from "next/navigation";

import { FanVideoFeed } from "@/components/fan/fan-video-feed";
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
    <main className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 md:py-10">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">{team.shortName} YouTube</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#0f0f0f] md:text-4xl">영상</h1>
        <p className="mt-3 text-sm text-[#606060]">구단 공식 영상과 현재 소속 선수 영상을 함께 봅니다.</p>
      </header>

      <FanVideoFeed teamSlug={team.fanSiteHost} teamName={team.shortName} videos={videos} />
    </main>
  );
}
