import { unstable_cache } from "next/cache";

import { fetchYoutubeFeedEntries, fetchYoutubeVideoEntries } from "@/lib/youtube-feed";
import { youtubeWatchUrl } from "@/lib/youtube";

/** LCK 공식 유튜브 채널(https://www.youtube.com/@LCK)의 채널 ID. */
export const LCK_OFFICIAL_CHANNEL_ID = "UCw1DsweY9b2AKGjV4kGJP1A";

export const LCK_CHANNEL_VIDEOS_TAG = "lck-channel-videos";

/** 홈은 팀 영상과 섞어 12개만 노출한다. 여유분까지 15개면 충분하다. */
const LCK_CHANNEL_VIDEO_LIMIT = 15;

export type HomeVideo = {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  publishedAt: string;
  channelName: string;
};

/**
 * LCK 공식 채널 영상은 팀 영상과 달리 DB에 동기화하지 않고 유튜브 피드에서 바로 읽는다.
 * 홈에서만 쓰는 노출용 데이터라 10분 캐시로 충분하다(피드는 최근 15개만 준다).
 */
export const getLckChannelVideos = unstable_cache(
  async (): Promise<HomeVideo[]> => {
    try {
      // Data API 키가 있으면 그쪽을 쓰되, 할당량이 소진되면 인증 없이 열리는 RSS 피드로 떨어진다.
      // (홈 노출용이라 조회수 없이 최근 15개만 있으면 충분하다.)
      // limit 없이 부르면 Data API가 채널 전체 업로드(1만 개 이상)를 페이지로 끝까지 훑어
      // 홈 렌더링이 수십 초 멈춘다. 홈에 쓰는 건 최신 몇 개뿐이라 첫 페이지에서 끊는다.
      const entries = await fetchYoutubeVideoEntries(LCK_OFFICIAL_CHANNEL_ID, {
        limit: LCK_CHANNEL_VIDEO_LIMIT,
      }).catch(() => fetchYoutubeFeedEntries(LCK_OFFICIAL_CHANNEL_ID));

      return entries.map((entry) => ({
        id: `lck-${entry.videoId}`,
        title: entry.title,
        videoUrl: youtubeWatchUrl(entry.videoId),
        thumbnailUrl: entry.thumbnailUrl,
        publishedAt: entry.publishedAt,
        channelName: "LCK",
      }));
    } catch {
      // 유튜브 피드 장애 시 홈 전체가 실패하지 않도록 빈 목록으로 떨어뜨린다.
      return [];
    }
  },
  ["lck-channel-videos"],
  { revalidate: 600, tags: [LCK_CHANNEL_VIDEOS_TAG] },
);
