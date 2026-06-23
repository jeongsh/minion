import Link from "next/link";
import { notFound } from "next/navigation";

import { FanInstagramFeed } from "@/components/fan/fan-instagram-feed";
import { FanPlayerProfiles } from "@/components/fan/fan-player-profiles";
import {
  getAllTeams,
  getFanVideoFeed,
  getInstagramStories,
  getMatches,
  getPlayers,
  getTeamByFanSiteHost,
  getTeamBySlug,
  getTeamInstagramFeed,
  getTeamNews,
} from "@/lib/data/lck";
import type { Match, Player, PlayerVideo, Team, TeamSocialPost, TeamVideo } from "@/lib/types";

export const dynamic = "force-dynamic";

const POSITION_ORDER: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];

type VideoItem = {
  id: string;
  ownerName: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  publishedAt: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function byMatchDate(a: Match, b: Match) {
  return new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
}

function videoTime(value: string) {
  return value ? new Date(value).getTime() : 0;
}

function teamForMatch(match: Match, team: Team, teams: Team[]) {
  const opponentId = match.teamAId === team.id ? match.teamBId : match.teamAId;
  return teams.find((item) => item.id === opponentId);
}

function toTeamVideoItem(video: TeamVideo, team: Team): VideoItem {
  return {
    id: `team-${video.id}`,
    ownerName: team.shortName,
    title: video.title,
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
  };
}

function toPlayerVideoItem(video: PlayerVideo, playersById: Map<string, Player>): VideoItem | null {
  const player = playersById.get(video.playerId);
  if (!player) return null;

  return {
    id: `player-${video.id}`,
    ownerName: player.name,
    title: video.title,
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
  };
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-md border border-border bg-surface shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function TeamLogo({ team, className }: { team?: Team; className: string }) {
  if (!team?.logoUrl) {
    return (
      <div className={`${className} flex items-center justify-center rounded-md bg-surface-muted text-sm font-bold`}>
        {team?.shortName ?? "-"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={team.logoUrl} alt={`${team.name} logo`} className={`${className} object-contain`} />
  );
}

function Hero({ team }: { team: Team }) {
  return (
    <section className="relative overflow-hidden rounded-md border border-[#1f1f24] bg-[#111] px-6 py-10 text-white shadow-sm md:px-14 md:py-14">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background: `linear-gradient(110deg, #111 0%, ${team.secondaryColor} 42%, ${team.primaryColor} 100%)`,
        }}
      />
      <div className="relative z-10 grid gap-8 md:grid-cols-[1fr_0.8fr] md:items-center">
        <div>
          <p className="text-xl font-bold">팬 사이트</p>
          <h1 className="mt-4 text-4xl font-black tracking-normal md:text-6xl">
            {team.shortName}
          </h1>
          <p className="mt-4 max-w-xl text-sm text-white/75 md:text-base">
            팀 소식, SNS, 영상, 선수와 경기 정보를 한곳에서 모아봅니다.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {["#TEAM", "#FAN", "#LCK"].map((label) => (
              <span
                key={label}
                className="rounded-md border border-accent/60 bg-black/20 px-3 py-1.5 text-xs font-black text-accent"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <TeamLogo team={team} className="h-36 w-52 drop-shadow-2xl md:h-48 md:w-80" />
        </div>
      </div>
    </section>
  );
}

function NextMatchCard({
  team,
  opponent,
  match,
}: {
  team: Team;
  opponent?: Team;
  match?: Match;
}) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-black tracking-normal">다음 경기</h2>
        <Link href="/schedule" className="text-sm font-bold text-accent">
          일정
        </Link>
      </div>
      <div className="mt-4 grid gap-5 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-center text-sm font-bold text-muted">
            {match?.name ?? "예정된 경기가 없습니다"}
          </p>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-black">{team.shortName}</span>
              <TeamLogo team={team} className="h-14 w-20" />
            </div>
            <span className="text-sm font-bold text-muted">VS</span>
            <div className="flex items-center justify-center gap-3">
              <TeamLogo team={opponent} className="h-14 w-20" />
              <span className="text-2xl font-black">{opponent?.shortName ?? "-"}</span>
            </div>
          </div>
        </div>
        <div className="grid gap-3 text-sm">
          <p>
            <span className="font-bold">일시: </span>
            {match ? formatDateTime(match.matchDate) : "-"}
          </p>
          <p>
            <span className="font-bold">장소: </span>
            {match?.venue ?? "-"}
          </p>
          <Link
            href={match ? `/matches/${match.id}` : "/schedule"}
            className="rounded-md border border-accent px-4 py-3 text-center text-sm font-bold text-accent hover:bg-surface-muted"
          >
            경기 상세
          </Link>
        </div>
      </div>
    </Card>
  );
}

function SocialSection({ posts }: { posts: TeamSocialPost[] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-black tracking-normal">SNS</h2>
        <span className="text-sm font-bold text-muted">{posts.length}개</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {posts.slice(0, 6).map((post) => (
          <Link
            key={post.id}
            href={post.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block min-w-0 rounded-md border border-border bg-background p-4 transition hover:border-accent"
          >
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-muted">
              <span className="uppercase">{post.platform}</span>
              <span>{formatDateTime(post.publishedAt)}</span>
            </div>
            <p className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold">{post.title}</p>
            {post.thumbnailUrl ? (
              <div className="mt-4 overflow-hidden rounded-md bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
              </div>
            ) : null}
          </Link>
        ))}
        {posts.length === 0 ? (
          <div className="rounded-md border border-border bg-background p-4 text-sm text-muted md:col-span-3">
            아직 동기화된 SNS 게시물이 없습니다.
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function VideoSection({ teamSlug, videos }: { teamSlug: string; videos: VideoItem[] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-black tracking-normal">영상</h2>
        <Link
          href={`/fan/${teamSlug}/videos`}
          className="rounded-md border border-accent px-3 py-2 text-sm font-bold text-accent"
        >
          전체 영상
        </Link>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {videos.slice(0, 4).map((video) => (
          <Link
            key={video.id}
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block min-w-0 overflow-hidden rounded-md border border-border bg-background transition hover:border-accent"
          >
            <div className="relative aspect-video bg-black">
              {video.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-sm font-semibold text-white/70">
                  YouTube
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="line-clamp-2 min-h-10 text-sm font-bold">{video.title}</p>
              <p className="mt-2 text-xs text-muted">
                {video.ownerName} · {formatDateTime(video.publishedAt)}
              </p>
            </div>
          </Link>
        ))}
        {videos.length === 0 ? (
          <div className="rounded-md border border-border bg-background p-4 text-sm text-muted md:col-span-4">
            아직 동기화된 영상이 없습니다.
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function OfficialLinks({ team }: { team: Team }) {
  const links = [
    { label: "공식 홈페이지", href: team.officialHomepageUrl },
    { label: "YouTube", href: team.officialYoutubeUrl },
    { label: "X", href: team.officialXUrl },
    { label: "Instagram", href: team.officialInstagramUrl },
  ].filter((link) => link.href);

  return (
    <Card className="p-5">
      <h2 className="text-xl font-black tracking-normal">공식 링크</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border bg-background px-4 py-3 text-sm font-bold hover:border-accent hover:text-accent"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

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

  const [teams, players, matches, news] = await Promise.all([
    getAllTeams(),
    getPlayers(),
    getMatches(),
    getTeamNews(team.id),
  ]);
  const teamPlayers = players
    .filter((player) => player.teamId === team.id)
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));
  const playerIds = teamPlayers.map((p) => p.id);
  const [instagramFeed, instagramStories, videoFeed] = await Promise.all([
    getTeamInstagramFeed(team.id, playerIds),
    getInstagramStories(team.id, playerIds),
    getFanVideoFeed(team.id, playerIds),
  ]);
  const teamMatches = matches
    .filter((match) => match.teamAId === team.id || match.teamBId === team.id)
    .sort(byMatchDate);
  const upcomingMatch =
    teamMatches.find((match) => match.status === "live") ??
    teamMatches.find((match) => match.status === "scheduled") ??
    [...teamMatches].reverse()[0];
  const opponent = upcomingMatch ? teamForMatch(upcomingMatch, team, teams) : undefined;
  const playersById = new Map(teamPlayers.map((player) => [player.id, player]));
  const videos = [
    ...videoFeed.teamVideos.map((video) => toTeamVideoItem(video, team)),
    ...videoFeed.playerVideos.flatMap((video) => {
      const item = toPlayerVideoItem(video, playersById);
      return item ? [item] : [];
    }),
  ].sort((a, b) => videoTime(b.publishedAt) - videoTime(a.publishedAt));

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-5 py-6">
      <Hero team={team} />
      <NextMatchCard team={team} opponent={opponent} match={upcomingMatch} />
      <FanPlayerProfiles players={teamPlayers} />
      <FanInstagramFeed
        teamName={team.shortName}
        teamInstagramUrl={team.officialInstagramUrl}
        teamPosts={instagramFeed.teamPosts}
        playerPosts={instagramFeed.playerPosts}
        stories={instagramStories}
        players={teamPlayers}
      />
      <SocialSection posts={news.socialPosts.filter((p) => p.platform !== "instagram")} />
      <VideoSection teamSlug={team.fanSiteHost} videos={videos} />
      <OfficialLinks team={team} />
    </main>
  );
}
