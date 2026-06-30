import type { Player, PlayerVideo, Team, TeamVideo } from "@/lib/types";

export type FanVideoItem = {
  id: string;
  routeId: string;
  ownerType: "team" | "player";
  ownerName: string;
  ownerImageUrl?: string;
  ownerUrl?: string;
  title: string;
  videoUrl: string;
  youtubeVideoId?: string;
  embedUrl?: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  isNew: boolean;
};

const NEW_VIDEO_WITHIN_MS = 5 * 24 * 60 * 60 * 1000;

function isRecentlyPublished(publishedAt: string) {
  if (!publishedAt) return false;

  const publishedTime = new Date(publishedAt).getTime();
  return Number.isFinite(publishedTime) && Date.now() - publishedTime <= NEW_VIDEO_WITHIN_MS;
}

function videoTime(value: string) {
  return value ? new Date(value).getTime() : 0;
}

function routeId(video: TeamVideo | PlayerVideo, ownerType: "team" | "player") {
  return video.youtubeVideoId ?? `${ownerType}-${video.id}`;
}

export function buildFanVideoItems({
  team,
  players,
  teamVideos,
  playerVideos,
}: {
  team: Team;
  players: Player[];
  teamVideos: TeamVideo[];
  playerVideos: PlayerVideo[];
}): FanVideoItem[] {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const items: FanVideoItem[] = teamVideos.map((video) => ({
    id: `team-${video.id}`,
    routeId: routeId(video, "team"),
    ownerType: "team",
    ownerName: team.shortName,
    ownerImageUrl: team.logoUrl,
    ownerUrl: team.officialYoutubeUrl,
    title: video.title,
    videoUrl: video.videoUrl,
    youtubeVideoId: video.youtubeVideoId,
    embedUrl: video.embedUrl,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
    viewCount: video.viewCount,
    isNew: video.isNew ?? isRecentlyPublished(video.publishedAt),
  }));

  for (const video of playerVideos) {
    const player = playersById.get(video.playerId);
    if (!player) continue;

    items.push({
      id: `player-${video.id}`,
      routeId: routeId(video, "player"),
      ownerType: "player",
      ownerName: player.name,
      ownerImageUrl: player.profileImageUrl,
      ownerUrl: player.youtubeUrl,
      title: video.title,
      videoUrl: video.videoUrl,
      youtubeVideoId: video.youtubeVideoId,
      embedUrl: video.embedUrl,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      viewCount: video.viewCount,
      isNew: video.isNew ?? isRecentlyPublished(video.publishedAt),
    });
  }

  return items.sort((first, second) => videoTime(second.publishedAt) - videoTime(first.publishedAt));
}

export function fanVideoDateLabel(value: string) {
  if (!value) return "게시일 미확인";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export function fanVideoMetaLabel(video: Pick<FanVideoItem, "publishedAt" | "viewCount">) {
  const parts: string[] = [];
  if (video.viewCount > 0) parts.push(`조회수 ${video.viewCount.toLocaleString("ko-KR")}회`);
  parts.push(fanVideoDateLabel(video.publishedAt));
  return parts.join(" · ");
}
