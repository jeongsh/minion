export function youtubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeEmbedUrl(videoId: string) {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeVideoIdFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/watch")) {
        return parsed.searchParams.get("v");
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      const videoIndex = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
      if (videoIndex >= 0) {
        return parts[videoIndex + 1] ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeYoutubeVideo(input: {
  videoUrl: string;
  youtubeVideoId?: string | null;
  embedUrl?: string | null;
  thumbnailUrl?: string | null;
}) {
  const videoId = input.youtubeVideoId ?? youtubeVideoIdFromUrl(input.videoUrl);

  return {
    youtubeVideoId: videoId,
    embedUrl: input.embedUrl ?? (videoId ? youtubeEmbedUrl(videoId) : input.videoUrl),
    thumbnailUrl: input.thumbnailUrl ?? (videoId ? youtubeThumbnailUrl(videoId) : ""),
  };
}
