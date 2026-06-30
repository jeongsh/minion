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
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-4 py-8 sm:px-6 md:py-10">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">{team.shortName} social</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] md:text-4xl">인스타그램</h1>
        <p className="mt-3 text-sm text-[#667085]">팀과 선수들의 최신 게시물을 한곳에서 확인하세요.</p>
      </header>

      <FanInstagramFeed
        teamSlug={team.fanSiteHost}
        teamName={team.shortName}
        teamInstagramUrl={team.officialInstagramUrl}
        teamPosts={instagramFeed.teamPosts}
        playerPosts={instagramFeed.playerPosts}
        stories={stories}
        players={teamPlayers}
      />
    </main>
  );
}
