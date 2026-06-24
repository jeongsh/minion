import { fetchYoutubeApiVideoEntries, fetchYoutubeApiVideoEntry } from "./youtube-api.ts";
import { youtubeThumbnailUrl } from "./youtube.ts";

export type YoutubeFeedEntry = {
  videoId: string;
  channelId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
};

export function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function matchXmlText(xml: string, pattern: RegExp) {
  return decodeXml(xml.match(pattern)?.[1]?.trim() ?? "");
}

export function youtubeFeedUrl(channelId: string) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

export function youtubeWebsubTopicUrl(channelId: string) {
  return `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

export function channelIdFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const channelIndex = parts.indexOf("channel");
    if (channelIndex >= 0) {
      return parts[channelIndex + 1] ?? null;
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolveYoutubeChannelId(url: string) {
  const direct = channelIdFromUrl(url);
  if (direct) return direct;

  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; LCKHubMinion/1.0)",
    },
  });
  if (!response.ok) {
    throw new Error(`YouTube channel page ${response.status}: ${url}`);
  }

  const html = await response.text();
  return (
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)"/)?.[1] ??
    html.match(/"externalId":"(UC[^"]+)"/)?.[1] ??
    html.match(/"channelId":"(UC[^"]+)"/)?.[1] ??
    html.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)/)?.[1] ??
    null
  );
}

export function parseYoutubeFeedEntries(xml: string): YoutubeFeedEntry[] {
  return xml
    .split("<entry>")
    .slice(1)
    .map((entry): YoutubeFeedEntry | null => {
      const videoId = matchXmlText(entry, /<yt:videoId>([^<]+)<\/yt:videoId>/);
      const channelId = matchXmlText(entry, /<yt:channelId>([^<]+)<\/yt:channelId>/);
      const title = matchXmlText(entry, /<title>([^<]+)<\/title>/);
      const publishedAt = matchXmlText(entry, /<published>([^<]+)<\/published>/);
      const thumbnailUrl =
        matchXmlText(entry, /<media:thumbnail url="([^"]+)"/) || youtubeThumbnailUrl(videoId);

      if (!videoId || !channelId || !title || !publishedAt) return null;

      return { videoId, channelId, title, publishedAt, thumbnailUrl };
    })
    .filter((entry): entry is YoutubeFeedEntry => Boolean(entry));
}

export async function fetchYoutubeFeedEntries(channelId: string) {
  const response = await fetch(youtubeFeedUrl(channelId));
  if (!response.ok) {
    throw new Error(`YouTube feed ${response.status}: ${channelId}`);
  }

  return parseYoutubeFeedEntries(await response.text());
}

export async function fetchYoutubeVideoEntries(
  channelId: string,
  options: { since?: Date } = {},
) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    return fetchYoutubeApiVideoEntries(channelId, { since: options.since, apiKey });
  }

  const entries = await fetchYoutubeFeedEntries(channelId);
  if (!options.since) return entries;

  return entries.filter((entry) => new Date(entry.publishedAt) >= options.since!);
}

export async function fetchYoutubeVideoEntry(channelId: string, videoId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    return fetchYoutubeApiVideoEntry(videoId, apiKey);
  }

  return (await fetchYoutubeFeedEntries(channelId)).find((entry) => entry.videoId === videoId) ?? null;
}
