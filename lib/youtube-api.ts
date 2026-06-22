import type { YoutubeFeedEntry } from "./youtube-feed.ts";
import { youtubeThumbnailUrl } from "./youtube.ts";

type YoutubeApiError = {
  error?: {
    message?: string;
  };
};

type PlaylistItemsResponse = {
  items?: Array<{
    snippet?: {
      channelId?: string;
      title?: string;
      publishedAt?: string;
      resourceId?: {
        kind?: string;
        videoId?: string;
      };
      thumbnails?: {
        high?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
  nextPageToken?: string;
};

type VideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      channelId?: string;
      title?: string;
      publishedAt?: string;
      thumbnails?: {
        high?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
};

function uploadsPlaylistId(channelId: string) {
  if (channelId.startsWith("UC")) {
    return `UU${channelId.slice(2)}`;
  }

  return channelId;
}

async function youtubeApiGet<T>(path: string, params: Record<string, string>, apiKey: string) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  const body = (await response.json()) as T & YoutubeApiError;
  if (!response.ok) {
    throw new Error(body.error?.message ?? `YouTube API ${response.status}: ${path}`);
  }

  return body;
}

function mapSnippetToEntry(
  videoId: string,
  channelId: string,
  snippet: NonNullable<PlaylistItemsResponse["items"]>[number]["snippet"],
): YoutubeFeedEntry | null {
  if (!snippet?.title || !snippet.publishedAt) return null;

  return {
    videoId,
    channelId: snippet.channelId ?? channelId,
    title: snippet.title,
    publishedAt: snippet.publishedAt,
    thumbnailUrl:
      snippet.thumbnails?.high?.url ??
      snippet.thumbnails?.default?.url ??
      youtubeThumbnailUrl(videoId),
  };
}

export async function fetchYoutubeApiVideoEntries(
  channelId: string,
  options: { since?: Date; apiKey: string },
): Promise<YoutubeFeedEntry[]> {
  const entries: YoutubeFeedEntry[] = [];
  let pageToken: string | undefined;

  while (true) {
    const params: Record<string, string> = {
      part: "snippet",
      playlistId: uploadsPlaylistId(channelId),
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await youtubeApiGet<PlaylistItemsResponse>("playlistItems", params, options.apiKey);

    for (const item of data.items ?? []) {
      const snippet = item.snippet;
      const videoId = snippet?.resourceId?.videoId;
      if (!snippet || snippet.resourceId?.kind !== "youtube#video" || !videoId) continue;

      if (options.since && new Date(snippet.publishedAt ?? 0) < options.since) {
        return entries;
      }

      const entry = mapSnippetToEntry(videoId, channelId, snippet);
      if (entry) entries.push(entry);
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return entries;
}

export async function fetchYoutubeApiVideoEntry(
  videoId: string,
  apiKey: string,
): Promise<YoutubeFeedEntry | null> {
  const data = await youtubeApiGet<VideosResponse>(
    "videos",
    { part: "snippet", id: videoId },
    apiKey,
  );

  const item = data.items?.[0];
  if (!item?.id || !item.snippet) return null;

  return mapSnippetToEntry(item.id, item.snippet.channelId ?? "", item.snippet);
}
