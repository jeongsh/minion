import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Heart, Play } from "lucide-react";

import type { FeedInstaItem } from "@/components/fan/fan-feed-mosaic";
import { FanHomeVideoSwiper } from "@/components/fan/fan-home-video-swiper";
import { FanSocialPreview } from "@/components/fan/fan-social-preview";
import { InstagramIcon } from "@/components/fan/instagram-post-modal";
import { TeamLogo } from "@/components/ui/team-logo";
import { getFanVideoFeed, getPlayers, getTeamInstagramFeed, getTeamsSortedByRank } from "@/lib/data/lck";
import { buildFanVideoItems } from "@/lib/fan-video-items";
import { getFollowedTeamIds } from "@/lib/fan/followed-teams";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "팀 | MINION",
  description: "LCK 참가팀 정보와 순위, 최근 경기 결과를 확인하세요.",
};

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const [{ team: selectedKey }, teams, players, followedTeamIds] = await Promise.all([
    searchParams,
    getTeamsSortedByRank(),
    getPlayers(),
    getFollowedTeamIds(),
  ]);
  const selectedTeam = teams.find((team) => team.fanSiteHost === selectedKey || team.slug === selectedKey) ?? teams[0];
  const followedTeamIdSet = new Set(followedTeamIds);
  const isFollowing = (team: (typeof teams)[number]) =>
    followedTeamIdSet.has(team.id) || followedTeamIdSet.has(team.fanSiteHost);
  const orderedTeams = teams
    .map((team, index) => ({ team, index }))
    .sort((a, b) => Number(isFollowing(b.team)) - Number(isFollowing(a.team)) || a.index - b.index)
    .map(({ team }) => team);

  if (!selectedTeam) {
    return <main className="layout-wide py-10"><p className="text-sm text-[var(--ui-muted)]">둘러볼 팀을 준비하고 있습니다.</p></main>;
  }

  const teamPlayers = players.filter((player) => player.teamId === selectedTeam.id);
  const playerIds = teamPlayers.map((player) => player.id);
  const [instagramFeed, videoFeed] = await Promise.all([
    getTeamInstagramFeed(selectedTeam.id, playerIds),
    getFanVideoFeed(selectedTeam.id, playerIds),
  ]);
  const playersById = new Map(teamPlayers.map((player) => [player.id, player]));
  const socialItems: FeedInstaItem[] = [
    ...instagramFeed.teamPosts.map((post) => ({
      id: `team-${post.id}`,
      ownerName: selectedTeam.shortName,
      caption: post.content || post.title,
      imageUrl: post.thumbnailUrl,
      sourceUrl: post.sourceUrl,
      postedAt: post.publishedAt,
    })),
    ...instagramFeed.playerPosts.map((post) => ({
      id: `player-${post.id}`,
      ownerName: playersById.get(post.playerId)?.name ?? "선수",
      caption: post.caption,
      imageUrl: post.imageUrl,
      sourceUrl: post.sourceUrl,
      postedAt: post.postedAt,
      likesCount: post.likesCount,
    })),
  ].sort((a, b) => new Date(b.postedAt ?? 0).getTime() - new Date(a.postedAt ?? 0).getTime());
  const videos = buildFanVideoItems({
    team: selectedTeam,
    players: teamPlayers,
    teamVideos: videoFeed.teamVideos,
    playerVideos: videoFeed.playerVideos,
  });

  return (
    <main className="min-h-screen text-[var(--ui-text)]">
      <section className="border-b border-[var(--ui-border)] bg-[var(--page-background)]" aria-labelledby="team-explorer-title">
        <div className="layout-wide py-6 sm:py-8">
          <h1 id="team-explorer-title" className="home-section-title text-[17px] tracking-[-0.02em] text-[var(--ui-ink)] sm:text-[22px]">팀 둘러보기</h1>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {orderedTeams.map((team) => {
              const active = team.id === selectedTeam.id;
              const following = isFollowing(team);
              return (
                <Link key={team.id} href={`/teams?team=${encodeURIComponent(team.fanSiteHost || team.slug)}`} scroll={false} aria-current={active ? "true" : undefined} data-following={following ? "true" : undefined} className={`relative flex w-[76px] shrink-0 flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition ${active ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "bg-[var(--ui-surface-muted)] hover:-translate-y-0.5"}`}>
                  {following ? <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]" title="팔로잉"><Heart size={11} fill="currentColor" aria-hidden="true" /><span className="sr-only">팔로잉</span></span> : null}
                  <span className={`grid h-12 w-12 place-items-center rounded-full ${active ? "bg-white" : "bg-[var(--ui-surface)]"}`}><TeamLogo team={team} size="h-9 w-9" plain themeAware={!active} /></span>
                  <span className="w-full truncate text-[13px] font-medium">{team.shortName}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="layout-wide pb-24 pt-7 sm:pt-10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-[var(--ui-surface-muted)] px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3"><TeamLogo team={selectedTeam} size="h-11 w-11" plain themeAware /><span className="min-w-0"><strong className="block truncate text-[16px] font-black">{selectedTeam.shortName}</strong><span className="hidden truncate text-[13px] text-[var(--ui-muted)] sm:block">소셜과 최신 영상을 미리 보고 팬페이지로 이동하세요.</span></span></div>
          <Link href={`/fan/${selectedTeam.fanSiteHost}`} className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-[var(--ui-ink)] px-3 text-[13px] font-medium text-[var(--ui-surface)] sm:min-h-11 sm:px-4">팬페이지 <ArrowRight size={15} /></Link>
        </div>

        <section className="mt-9" aria-labelledby="team-social-title">
          <div className="mb-4 flex items-center gap-2"><InstagramIcon className="h-[18px] w-[18px]" /><h2 id="team-social-title" className="home-section-title text-[15px] text-[var(--ui-ink)] sm:text-[length:var(--ui-title-size)]">최신 소셜 피드</h2></div>
          <FanSocialPreview items={socialItems} />
        </section>

        <section className="mt-10" aria-labelledby="team-video-title">
          <div className="mb-4 flex items-center gap-2"><Play size={18} /><h2 id="team-video-title" className="home-section-title text-[15px] text-[var(--ui-ink)] sm:text-[length:var(--ui-title-size)]">최신 영상</h2></div>
          <FanHomeVideoSwiper teamSlug={selectedTeam.fanSiteHost} videos={videos} />
        </section>
      </div>
    </main>
  );
}
