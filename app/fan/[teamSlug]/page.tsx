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
    <section className={`rounded-3xl border border-[#e6e9ef] bg-white shadow-sm ${className}`}>
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
    <section className="relative min-h-[290px] overflow-hidden rounded-[28px] border border-[#1f1f24] bg-[#111] px-6 py-7 text-white shadow-xl shadow-black/10 md:min-h-[360px] md:px-10 md:py-10">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(circle at 88% 18%, ${team.primaryColor} 0%, transparent 42%), linear-gradient(145deg, #0b0c0f 8%, ${team.secondaryColor} 100%)`,
        }}
      />
      <div className="absolute -bottom-8 -right-10 z-0 opacity-25 md:bottom-2 md:right-2 md:opacity-70">
        <TeamLogo team={team} className="h-48 w-64 drop-shadow-2xl md:h-56 md:w-72" />
      </div>
      <div className="relative z-10 flex h-full max-w-xl flex-col">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">{team.shortName} fan hub</p>
          <h1 className="mt-3 text-5xl font-black tracking-[-0.05em] md:text-6xl">
            {team.shortName}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
            오늘의 경기와 우리 팀 최신 업데이트를 가장 빠르게 확인하세요.
          </p>
      </div>
    </section>
  );
}

function NextMatchCard({
  team,
  opponent,
  match,
  mode,
}: {
  team: Team;
  opponent?: Team;
  match?: Match;
  mode: "live" | "upcoming" | "recent" | "empty";
}) {
  const title = mode === "live" ? "진행 중인 경기" : mode === "upcoming" ? "다음 경기" : mode === "recent" ? "최근 경기" : "경기 일정";
  const badge = mode === "live" ? "LIVE" : mode === "upcoming" ? "UP NEXT" : mode === "recent" ? "RESULT" : "SCHEDULE";

  return (
    <Card className="flex min-h-[300px] flex-col p-5 md:min-h-[360px] md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Match center</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.02em]">{title}</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black tracking-[0.12em] ${mode === "live" ? "bg-red-500 text-white" : "bg-accent/10 text-accent"}`}>
          {badge}
        </span>
      </div>
      <div className="mt-5 flex flex-1 flex-col justify-between gap-5">
        <div className="rounded-2xl border border-[#e8ebf0] bg-[#f8f9fb] p-5">
          <p className="text-center text-sm font-bold text-muted">
            {match?.name ?? "예정된 경기가 없습니다"}
          </p>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
              <TeamLogo team={team} className="h-14 w-16" />
              <span className="text-xl font-black">{team.shortName}</span>
            </div>
            <div className="text-center">
              {mode === "recent" && match?.teamAScore != null && match?.teamBScore != null ? (
                <span className="text-2xl font-black tabular-nums">{match?.teamAScore} : {match?.teamBScore}</span>
              ) : (
                <span className="text-xs font-black text-muted">VS</span>
              )}
            </div>
            <div className="flex flex-col-reverse items-center justify-center gap-2 sm:flex-row">
              <span className="text-xl font-black">{opponent?.shortName ?? "-"}</span>
              <TeamLogo team={opponent} className="h-14 w-16" />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-black">{match ? formatDateTime(match.matchDate) : "일정 미정"}</p>
            <p className="mt-1 text-xs text-muted">{match?.venue || "장소 미정"}</p>
          </div>
          <Link
            href={match ? `/matches/${match.id}` : "/schedule"}
            className="rounded-full bg-accent px-5 py-3 text-center text-sm font-black text-white transition hover:opacity-90"
          >
            {match ? "경기 상세 →" : "전체 일정 →"}
          </Link>
        </div>
      </div>
    </Card>
  );
}

function SocialSection({ posts }: { posts: TeamSocialPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="py-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black tracking-[-0.02em]">최신 소식</h2>
        <span className="text-sm font-bold text-muted">{posts.length}개</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {posts.slice(0, 3).map((post) => (
          <Link
            key={post.id}
            href={post.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block min-w-0 rounded-2xl border border-[#e6e9ef] bg-white p-4 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg hover:shadow-black/5"
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
      </div>
    </section>
  );
}

function VideoSection({ teamSlug, videos }: { teamSlug: string; videos: VideoItem[] }) {
  return (
    <section className="py-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Watch now</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.02em]">최신 영상</h2>
        </div>
        <Link
          href={`/fan/${teamSlug}/videos`}
          className="rounded-full border border-[#dfe3ea] px-4 py-2 text-sm font-bold text-[#475467] transition hover:border-accent hover:text-accent"
        >
          전체 영상
        </Link>
      </div>
      <div className="scrollbar-none mt-4 grid grid-flow-col auto-cols-[82%] gap-4 overflow-x-auto pb-2 sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
        {videos.slice(0, 3).map((video) => (
          <Link
            key={video.id}
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block min-w-0 overflow-hidden rounded-2xl border border-[#e6e9ef] bg-white transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg hover:shadow-black/5"
          >
            <div className="relative aspect-video bg-black">
              {video.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
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
            아직 새 영상이 없습니다.
          </div>
        ) : null}
      </div>
    </section>
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
    <section className="flex flex-col gap-4 rounded-2xl border border-[#e6e9ef] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-sm font-black">공식 채널</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#f4f5f8] px-3.5 py-2 text-xs font-bold text-[#475467] transition hover:bg-accent/10 hover:text-accent"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
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
  // This page is force-dynamic; request time is required to exclude stale scheduled matches.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const liveMatch = teamMatches.find((match) => match.status === "live");
  const nextMatch = teamMatches.find(
    (match) => match.status === "scheduled" && new Date(match.matchDate).getTime() >= now,
  );
  const recentMatch = [...teamMatches]
    .reverse()
    .find((match) => match.status === "completed" || new Date(match.matchDate).getTime() < now);
  const featuredMatch = liveMatch ?? nextMatch ?? recentMatch;
  const featuredMatchMode = liveMatch
    ? "live"
    : nextMatch
      ? "upcoming"
      : recentMatch
        ? "recent"
        : "empty";
  const opponent = featuredMatch ? teamForMatch(featuredMatch, team, teams) : undefined;
  const playersById = new Map(teamPlayers.map((player) => [player.id, player]));
  const videos = [
    ...videoFeed.teamVideos.map((video) => toTeamVideoItem(video, team)),
    ...videoFeed.playerVideos.flatMap((video) => {
      const item = toPlayerVideoItem(video, playersById);
      return item ? [item] : [];
    }),
  ].sort((a, b) => videoTime(b.publishedAt) - videoTime(a.publishedAt));

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 px-4 py-6 sm:px-6 md:py-8">
      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Hero team={team} />
        <NextMatchCard team={team} opponent={opponent} match={featuredMatch} mode={featuredMatchMode} />
      </section>
      <FanInstagramFeed
        teamSlug={team.fanSiteHost}
        teamName={team.shortName}
        teamLogoUrl={team.logoUrl}
        teamInstagramUrl={team.officialInstagramUrl}
        teamPosts={instagramFeed.teamPosts}
        playerPosts={instagramFeed.playerPosts}
        stories={instagramStories}
        players={teamPlayers}
        variant="preview"
      />
      <SocialSection posts={news.socialPosts.filter((p) => p.platform !== "instagram")} />
      <VideoSection teamSlug={team.fanSiteHost} videos={videos} />
      <FanPlayerProfiles players={teamPlayers} teamSlug={team.fanSiteHost} />
      <OfficialLinks team={team} />
    </main>
  );
}
