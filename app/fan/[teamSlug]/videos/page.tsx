import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionHeader } from "@/components/layout/section-header";
import {
  getFanVideoFeed,
  getPlayers,
  getTeamByFanSiteHost,
  getTeamBySlug,
} from "@/lib/data/lck";
import type { Player, PlayerVideo, TeamVideo } from "@/lib/types";

type VideoItem = {
  id: string;
  ownerType: "team" | "player";
  ownerName: string;
  ownerSlug?: string;
  title: string;
  videoUrl: string;
  embedUrl?: string;
  thumbnailUrl: string;
  publishedAt: string;
  isNew?: boolean;
};

function dateLabel(value: string) {
  if (!value) return "게시일 미확인";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function videoTime(value: string) {
  return value ? new Date(value).getTime() : 0;
}

function teamVideoItem(video: TeamVideo, ownerName: string): VideoItem {
  return {
    id: `team-${video.id}`,
    ownerType: "team",
    ownerName,
    title: video.title,
    videoUrl: video.videoUrl,
    embedUrl: video.embedUrl,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
    isNew: video.isNew,
  };
}

function playerVideoItem(video: PlayerVideo, playersById: Map<string, Player>): VideoItem | null {
  const player = playersById.get(video.playerId);
  if (!player) return null;

  return {
    id: `player-${video.id}`,
    ownerType: "player",
    ownerName: player.name,
    ownerSlug: player.slug,
    title: video.title,
    videoUrl: video.videoUrl,
    embedUrl: video.embedUrl,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
    isNew: video.isNew,
  };
}

function VideoCard({ video }: { video: VideoItem }) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative aspect-video bg-black">
        {video.embedUrl ? (
          <iframe
            src={video.embedUrl}
            title={video.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        ) : video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-sm font-semibold text-white/70">
            YouTube
          </div>
        )}
        {video.isNew ? (
          <span className="absolute left-3 top-3 rounded bg-red-600 px-2 py-1 text-xs font-black text-white">
            NEW
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          <span className="rounded-md border border-border bg-background px-2 py-1">
            {video.ownerType === "team" ? "구단" : "선수"}
          </span>
          {video.ownerSlug ? (
            <Link href={`/players/${video.ownerSlug}`} className="hover:text-accent">
              {video.ownerName}
            </Link>
          ) : (
            <span>{video.ownerName}</span>
          )}
          <span>{dateLabel(video.publishedAt)}</span>
        </div>
        <h2 className="line-clamp-2 min-h-12 text-base font-semibold leading-6">{video.title}</h2>
        <Link
          href={video.videoUrl}
          className="mt-4 inline-flex rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
          target="_blank"
        >
          YouTube에서 열기
        </Link>
      </div>
    </article>
  );
}

export default async function FanVideosPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const players = (await getPlayers())
    .filter((player) => player.teamId === team.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const playersById = new Map(players.map((player) => [player.id, player]));
  const feed = await getFanVideoFeed(team.id, players.map((player) => player.id));
  const videos = [
    ...feed.teamVideos.map((video) => teamVideoItem(video, team.shortName)),
    ...feed.playerVideos.flatMap((video) => {
      const item = playerVideoItem(video, playersById);
      return item ? [item] : [];
    }),
  ].sort((a, b) => videoTime(b.publishedAt) - videoTime(a.publishedAt));
  const newVideos = videos.filter((video) => video.isNew);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader
        eyebrow={team.shortName}
        title="영상"
      />
      <p className="-mt-6 max-w-3xl text-sm text-muted">
        구단 공식 YouTube와 현재 소속 선수 YouTube 영상만 모아 봅니다.
      </p>

      {newVideos.length > 0 ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-950">
          <p className="text-sm font-black">새 영상 {newVideos.length}개</p>
          <div className="mt-3 grid gap-2">
            {newVideos.slice(0, 4).map((video) => (
              <Link
                key={video.id}
                href={video.videoUrl}
                target="_blank"
                className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm hover:bg-red-100"
              >
                <span className="truncate font-semibold">{video.title}</span>
                <span className="shrink-0 text-xs">{video.ownerName}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {videos.length > 0 ? (
          videos.map((video) => <VideoCard key={video.id} video={video} />)
        ) : (
          <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted md:col-span-2 xl:col-span-3">
            아직 동기화된 YouTube 영상이 없습니다. 관리자 스크립트에서 YouTube 영상 동기화를 실행하면 이곳에 표시됩니다.
          </div>
        )}
      </section>
    </main>
  );
}
