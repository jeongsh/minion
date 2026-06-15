import { notFound } from "next/navigation";
import { MatchCard } from "@/components/domain/match-card";
import { SourceNotice } from "@/components/domain/source-notice";
import { FanSiteHero } from "@/components/fan/fan-site-hero";
import { SectionHeader } from "@/components/layout/section-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  getCommunityPosts,
  getMatches,
  getPlayers,
  getTeamByFanSiteHost,
  getTeamBySlug,
  getTeamNews,
  getTeams,
} from "@/lib/data/lck";

export default async function FanHomePage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const [teams, players, matches, posts, news] = await Promise.all([
    getTeams(),
    getPlayers(),
    getMatches(),
    getCommunityPosts(),
    getTeamNews(team.id),
  ]);
  const teamPlayers = players.filter((player) => player.teamId === team.id);
  const teamMatches = matches.filter(
    (match) => match.teamAId === team.id || match.teamBId === team.id,
  );
  const teamPosts = posts.filter((post) => post.siteScope === "team" && post.teamId === team.id);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <FanSiteHero teamSlug={teamSlug} />
      <section className="page-grid" aria-label="팬 사이트 요약">
        <StatCard label="팀 선수" value={teamPlayers.length} />
        <StatCard label="팀 관련 경기" value={teamMatches.length} />
        <StatCard label="커뮤니티 글" value={teamPosts.length} />
        <StatCard label="팀 소식" value={news.videos.length + news.socialPosts.length} />
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeader title="다음 경기" />
        <div className="page-grid">
          {teamMatches.slice(0, 2).map((match) => (
            <MatchCard key={match.id} match={match} teams={teams} />
          ))}
        </div>
      </section>
      <SourceNotice />
    </main>
  );
}
