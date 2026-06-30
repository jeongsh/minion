"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { FanFeedTabs, buildOwnerTabs } from "@/components/fan/fan-feed-tabs";
import { fanVideoMetaLabel, type FanVideoItem } from "@/lib/fan-video-items";
import { preloadImage } from "@/lib/preload-image";

const INITIAL_LIMIT = 12;
const BATCH_SIZE = 12;

function preloadVideoImages(videos: FanVideoItem[]) {
  const urls = videos.flatMap((video) =>
    video.thumbnailUrl ? [video.thumbnailUrl] : [],
  );
  return Promise.all(urls.map(preloadImage));
}

function VideoOwnerAvatar({ video }: { video: FanVideoItem }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5e5e5] text-[10px] font-black text-[#606060]">
      {video.ownerImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.ownerImageUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        video.ownerName.slice(0, 2)
      )}
    </span>
  );
}

export function FanVideoFeed({
  teamSlug,
  teamName,
  videos,
}: {
  teamSlug: string;
  teamName: string;
  videos: FanVideoItem[];
}) {
  const [activeKey, setActiveKey] = useState("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_LIMIT);
  const [isTabPending, setIsTabPending] = useState(false);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const tabLockRef = useRef(false);
  const tabUnlockTimerRef = useRef<number | null>(null);

  const tabs = buildOwnerTabs(videos, teamName);
  const filteredVideos = useMemo(
    () =>
      activeKey === "all"
        ? videos
        : videos.filter((video) => video.ownerName === activeKey),
    [videos, activeKey],
  );

  // 다음 탭의 첫 화면 썸네일을 먼저 받은 뒤 완성된 화면으로 교체한다.
  const handleTabChange = async (key: string) => {
    if (key === activeKey || tabLockRef.current) return;

    tabLockRef.current = true;
    setIsTabPending(true);
    const nextVideos =
      key === "all" ? videos : videos.filter((video) => video.ownerName === key);
    await preloadVideoImages(nextVideos.slice(0, INITIAL_LIMIT));
    setActiveKey(key);
    setVisibleCount(INITIAL_LIMIT);

    tabUnlockTimerRef.current = window.setTimeout(() => {
      tabLockRef.current = false;
      setIsTabPending(false);
      tabUnlockTimerRef.current = null;
    }, 0);
  };

  useEffect(() => {
    return () => {
      if (tabUnlockTimerRef.current !== null) {
        window.clearTimeout(tabUnlockTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (visibleCount >= filteredVideos.length) return;

    const target = sentinelRef.current;
    if (!target) return;

    // cancelled: 탭 전환 등으로 effect가 정리되면 진행 중이던 배치 결과를 버린다.
    // loading: 같은 화면에서 옵저버가 연속 발화해도 한 번만 불러온다.
    let cancelled = false;
    let loading = false;

    const loadNextBatch = async () => {
      if (loading) return;
      loading = true;
      setIsBatchLoading(true);

      const nextCount = Math.min(filteredVideos.length, visibleCount + BATCH_SIZE);
      await preloadVideoImages(filteredVideos.slice(visibleCount, nextCount));
      if (cancelled) return;

      setIsBatchLoading(false);
      setVisibleCount(nextCount);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        void loadNextBatch();
      },
      { rootMargin: "120px 0px" },
    );

    observer.observe(target);
    return () => {
      cancelled = true;
      observer.disconnect();
      setIsBatchLoading(false);
    };
  }, [filteredVideos, visibleCount]);

  if (videos.length === 0) {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl border border-[#e5e5e5] bg-white p-8 text-center">
        <div>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f2f2f2]">
            <Play className="h-6 w-6 text-[#606060]" />
          </span>
          <p className="mt-4 text-sm text-[#606060]">아직 동기화된 YouTube 영상이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <FanFeedTabs
        tabs={tabs}
        activeKey={activeKey}
        onChange={handleTabChange}
        isPending={isTabPending}
      />

      <section
        aria-busy={isTabPending || isBatchLoading}
        className="grid items-start gap-x-4 gap-y-9 sm:grid-cols-2 lg:grid-cols-3"
      >
        {filteredVideos.slice(0, visibleCount).map((video) => (
          <Link
            key={video.id}
            href={`/fan/${teamSlug}/videos/${encodeURIComponent(video.routeId)}`}
            className="group block min-w-0"
            data-testid="fan-video-card"
          >
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
              {video.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="grid h-full place-items-center text-sm font-semibold text-white/70">YouTube</div>
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/15 group-hover:opacity-100">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-black/75 text-white">
                  <Play className="ml-0.5 h-5 w-5 fill-white" />
                </span>
              </span>
              {video.isNew ? (
                <span className="absolute left-2 top-2 rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white">NEW</span>
              ) : null}
            </div>
            <div className="mt-3 flex gap-3">
              <VideoOwnerAvatar video={video} />
              <div className="min-w-0">
                <h2 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-5 text-[#0f0f0f]">{video.title}</h2>
                <p className="mt-1 truncate text-sm text-[#606060]">{video.ownerName}</p>
                <p className="truncate text-xs text-[#606060]">{fanVideoMetaLabel(video)}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      {visibleCount < filteredVideos.length ? (
        <div ref={sentinelRef} data-testid="video-infinite-sentinel" className="grid h-28 place-items-center">
          {isBatchLoading ? (
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#d9d9d9] border-t-[#0f0f0f]" />
          ) : (
            <span className="sr-only">다음 영상 준비</span>
          )}
        </div>
      ) : filteredVideos.length > INITIAL_LIMIT ? (
        <p className="py-10 text-center text-xs text-[#606060]">모든 영상을 확인했습니다.</p>
      ) : null}
    </>
  );
}
