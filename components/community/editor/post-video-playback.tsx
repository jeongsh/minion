"use client";

import { useEffect, useRef, type ReactNode } from "react";

const AUDIO_SETTINGS_KEY = "minion:post-video-audio:v1";

function readAudioSettings(): { muted: boolean; volume: number } {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY) ?? "null");
    if (saved && typeof saved === "object" && "muted" in saved && "volume" in saved
      && typeof saved.muted === "boolean" && typeof saved.volume === "number"
      && Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 1) {
      return { muted: saved.muted, volume: saved.volume };
    }
  } catch {
    // Playback still works when browser storage is unavailable or invalid.
  }
  return { muted: false, volume: 1 };
}

function playVideo(video: HTMLVideoElement) {
  void video.play().catch((error: unknown) => {
    // Browser autoplay policy and interrupted playback leave native controls available.
    if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) return;
    console.error("동영상 재생 실패:", error);
  });
}

export function PostVideoPlayback({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const videos = Array.from(container.querySelectorAll("video"));
    if (videos.length === 0) return;

    const settings = readAudioSettings();
    for (const video of videos) {
      video.muted = settings.muted;
      video.volume = settings.volume;
    }
    const onVolumeChange = (event: Event) => {
      if (!(event.target instanceof HTMLVideoElement)) return;
      const { muted, volume } = event.target;
      for (const video of videos) {
        if (video.muted !== muted) video.muted = muted;
        if (video.volume !== volume) video.volume = volume;
      }
      try {
        localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ muted, volume }));
      } catch {
        // Private browsing may prevent persistence; keep the current playback settings.
      }
    };
    const onPlay = (event: Event) => {
      if (!(event.target instanceof HTMLVideoElement)) return;
      for (const video of videos) {
        if (video !== event.target) video.pause();
      }
    };
    const onEnded = (event: Event) => {
      if (!(event.target instanceof HTMLVideoElement)) return;
      const current = event.target;
      const next = videos[videos.indexOf(current) + 1];
      if (!next) return;
      next.muted = current.muted;
      next.volume = current.volume;
      next.currentTime = 0;
      playVideo(next);
    };

    container.addEventListener("play", onPlay, true);
    container.addEventListener("ended", onEnded, true);
    container.addEventListener("volumechange", onVolumeChange, true);
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      if (videos.every((video) => video.paused && video.currentTime === 0)) playVideo(videos[0]);
    }, { threshold: 0.25 });
    observer.observe(videos[0]);

    return () => {
      container.removeEventListener("play", onPlay, true);
      container.removeEventListener("ended", onEnded, true);
      container.removeEventListener("volumechange", onVolumeChange, true);
      observer.disconnect();
      for (const video of videos) video.pause();
    };
  }, [children]);

  return <div ref={containerRef}>{children}</div>;
}
