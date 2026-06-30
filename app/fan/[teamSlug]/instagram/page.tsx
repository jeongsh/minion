import { notFound } from "next/navigation";

import { FanInstagramFeed } from "@/components/fan/fan-instagram-feed";
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
    <main className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 md:py-10">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">{team.shortName} Instagram</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#0f0f0f] md:text-4xl">인스타그램</h1>
        <p className="mt-3 text-sm text-[#606060]">구단 공식 계정과 현재 소속 선수들의 Instagram 게시물을 함께 봅니다.</p>
      </header>

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
    </main>
  );
}
