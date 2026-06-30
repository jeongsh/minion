import { Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FanVideoActions } from "@/components/fan/fan-video-actions";
import {
  getFanVideoFeed,
  getPlayers,
  getTeamByFanSiteHost,
  getTeamBySlug,
} from "@/lib/data/lck";
import {
  buildFanVideoItems,
  fanVideoDateLabel,
  fanVideoMetaLabel,
  type FanVideoItem,
} from "@/lib/fan-video-items";

export const dynamic = "force-dynamic";

function RelatedVideo({ teamSlug, video }: { teamSlug: string; video: FanVideoItem }) {
  return (
    <Link
      href={`/fan/${teamSlug}/videos/${encodeURIComponent(video.routeId)}`}
      className="group grid grid-cols-[168px_minmax(0,1fr)] gap-2"
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full place-items-center text-white/70"><Play className="h-5 w-5" /></span>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm font-semibold leading-[1.25rem] text-[#0f0f0f] group-hover:text-accent">{video.title}</h3>
        <p className="mt-1 truncate text-xs text-[#606060]">{video.ownerName}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-[#606060]">{fanVideoMetaLabel(video)}</p>
      </div>
    </Link>
  );
}

export default async function FanVideoDetailPage({
  params,
}: {
  params: Promise<{ teamSlug: string; videoId: string }>;
}) {
  const { teamSlug, videoId } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  const players = (await getPlayers()).filter((player) => player.teamId === team.id);
  const feed = await getFanVideoFeed(team.id, players.map((player) => player.id));
  const videos = buildFanVideoItems({
    team,
    players,
    teamVideos: feed.teamVideos,
    playerVideos: feed.playerVideos,
  });
  const video = videos.find((item) => item.routeId === videoId || item.id === videoId);
  if (!video) notFound();

  const embedUrl = video.embedUrl ?? (video.youtubeVideoId ? `https://www.youtube.com/embed/${video.youtubeVideoId}` : undefined);
  const related = videos
    .filter((item) => item.id !== video.id)
    .sort((first, second) => Number(second.ownerName === video.ownerName) - Number(first.ownerName === video.ownerName))
    .slice(0, 16);

  return (
    <main className="mx-auto grid w-full max-w-[1440px] gap-7 px-4 py-6 sm:px-6 lg:box-border lg:h-[calc(100vh-130px)] lg:grid-cols-[minmax(0,1fr)_390px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:py-6">
      <article className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-sm">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={video.title}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <Link href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="relative block h-full w-full">
              {video.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.thumbnailUrl} alt="" className="h-full w-full object-contain" />
              ) : null}
              <span className="absolute inset-0 grid place-items-center text-white"><Play className="h-14 w-14 fill-white" /></span>
            </Link>
          )}
        </div>

        <h1 className="mt-4 text-xl font-bold leading-7 tracking-[-0.02em] text-[#0f0f0f]">{video.title}</h1>

        <div className="mt-4 flex flex-col gap-4 border-b border-[#e5e5e5] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f2f2] text-xs font-black text-[#606060]">
              {video.ownerImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.ownerImageUrl} alt="" className="h-full w-full object-contain" />
              ) : video.ownerName.slice(0, 2)}
            </span>
            <div className="min-w-0">
              {video.ownerUrl ? (
                <Link href={video.ownerUrl} target="_blank" rel="noopener noreferrer" className="truncate text-base font-semibold text-[#0f0f0f] hover:text-accent">
                  {video.ownerName}
                </Link>
              ) : (
                <p className="truncate text-base font-semibold text-[#0f0f0f]">{video.ownerName}</p>
              )}
              <p className="text-xs text-[#606060]">{video.ownerType === "team" ? "공식 구단 채널" : "선수 채널"}</p>
            </div>
          </div>
          <FanVideoActions videoUrl={video.videoUrl} />
        </div>

        <section className="mt-4 rounded-xl bg-[#f2f2f2] p-4 text-sm text-[#0f0f0f]">
          <p className="font-semibold">{fanVideoMetaLabel(video)}</p>
          <p className="mt-2 leading-6 text-[#3f3f3f]">
            {video.ownerName} 채널의 {fanVideoDateLabel(video.publishedAt)} 게시 영상입니다. 영상 설명과 댓글은 YouTube 원문에서 확인할 수 있습니다.
          </p>
        </section>
      </article>

      <aside className="flex min-w-0 flex-col lg:min-h-0 lg:overflow-hidden">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="text-base font-bold text-[#0f0f0f]">관련 영상</h2>
          <Link href={`/fan/${team.fanSiteHost}/videos`} className="text-xs font-semibold text-[#606060] hover:text-accent">전체 보기</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-1 lg:overflow-y-auto lg:pr-1">
          {related.map((item) => <RelatedVideo key={item.id} teamSlug={team.fanSiteHost} video={item} />)}
        </div>
      </aside>
    </main>
  );
}
