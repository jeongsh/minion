"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { FanFeedTabs, buildOwnerTabs } from "@/components/fan/fan-feed-tabs";
import { fanVideoMetaLabel, type FanVideoItem } from "@/lib/fan-video-items";
import { useMediaPages, type MediaPagination } from "@/components/fan/use-media-pages";
import type { MediaPage, MediaTab } from "@/lib/fan/media-feed";
import { preloadImage } from "@/lib/preload-image";

const INITIAL_LIMIT = 12;
const BATCH_SIZE = 12;

function preloadVideoImages(videos: FanVideoItem[]) {
  const urls = videos.flatMap((video) =>
    video.thumbnailUrl ? [video.thumbnailUrl] : [],
  );
  return Promise.all(urls.map((url) => preloadImage(url)));
}

function VideoOwnerAvatar({ video }: { video: FanVideoItem }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5e5e5] text-[13px] font-medium text-[#606060]">
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
  pagination,
}: {
  teamSlug: string;
  teamName: string;
  videos: FanVideoItem[];
  pagination?: MediaPagination;
}) {
  const [localActiveKey, setActiveKey] = useState("all");
  const activeKey = pagination?.owner ?? localActiveKey;
  const [visibleCount, setVisibleCount] = useState(INITIAL_LIMIT);
  const isTabPending = Boolean(pagination?.loading);
  const isBatchLoading = Boolean(pagination?.loading);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const tabs = pagination?.tabs ?? buildOwnerTabs(videos, teamName);
  const filteredVideos = useMemo(
    () =>
      activeKey === "all"
        ? videos
        : videos.filter((video) => video.ownerName === activeKey),
    [videos, activeKey],
  );

  // 선택은 즉시 바꾸고 이미지는 각 자리에서 불러온다.
  const handleTabChange = (key: string) => {
    if (key === activeKey) return;
    if (pagination) { pagination.select(key); setVisibleCount(INITIAL_LIMIT); return; }

    const nextVideos =
      key === "all" ? videos : videos.filter((video) => video.ownerName === key);
    setActiveKey(key);
    setVisibleCount(INITIAL_LIMIT);

    void preloadVideoImages(nextVideos.slice(0, INITIAL_LIMIT));
  };

  useEffect(() => {
    if (visibleCount >= filteredVideos.length && !pagination?.hasMore) return;

    if (pagination?.loading || pagination?.error) return;
    const target = sentinelRef.current;
    if (!target) return;

    // loading: 같은 화면에서 옵저버가 연속 발화해도 한 번만 불러온다.
    let loading = false;

    const loadNextBatch = () => {
      if (loading) return;
      loading = true;
      if (visibleCount >= filteredVideos.length && pagination?.hasMore) { void pagination.loadMore(); return; }

      const nextCount = Math.min(filteredVideos.length, visibleCount + BATCH_SIZE);
      void preloadVideoImages(filteredVideos.slice(visibleCount, nextCount));

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
      observer.disconnect();
    };
  }, [filteredVideos, visibleCount, pagination]);

  if (videos.length === 0 && !pagination?.loading && !pagination?.error) {
    return (
      <div className="fan-card grid min-h-64 place-items-center p-8 text-center">
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
      {pagination?.loading && videos.length === 0 ? <div className="h-64 animate-pulse bg-[var(--ui-surface-muted)]" role="status" aria-label="영상 불러오는 중" /> : null}
      {pagination?.error ? <button type="button" onClick={pagination.loadMore} className="min-h-11 text-sm font-medium text-[var(--ui-text)]">{pagination.error}</button> : null}
      <FanFeedTabs
        tabs={tabs}
        activeKey={activeKey}
        onChange={handleTabChange}
        isPending={isTabPending}
      />

      <section
        aria-busy={isTabPending || isBatchLoading}
        className="grid grid-cols-2 items-start gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-9 lg:grid-cols-3"
      >
        {filteredVideos.slice(0, visibleCount).map((video) => (
          <Link
            key={video.id}
            href={`/fan/${teamSlug}/videos/${encodeURIComponent(video.routeId)}`}
            className="group block min-w-0"
            data-testid="fan-video-card"
          >
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black sm:rounded-xl">
              {video.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  loading="lazy"
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
                <span className="absolute left-1.5 top-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[13px]">NEW</span>
              ) : null}
            </div>
            <div className="mt-2 flex gap-2 sm:mt-3 sm:gap-3">
              <div className="hidden sm:block">
                <VideoOwnerAvatar video={video} />
              </div>
              <div className="min-w-0">
                <h2 className="line-clamp-2 text-[12px] font-medium leading-4 text-[#0f0f0f] sm:text-[15px] sm:leading-5">{video.title}</h2>
                <p className="mt-1 truncate text-[12px] text-[#606060] sm:text-sm">{video.ownerName}</p>
                <p className="hidden truncate text-[13px] text-[#606060] sm:block">{fanVideoMetaLabel(video)}</p>
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
        <p className="py-10 text-center text-[13px] text-[#606060]">모든 영상을 확인했습니다.</p>
      ) : null}
    </>
  );
}

export function PagedFanVideoFeed({ teamSlug, teamName, initialPage, tabs }: { teamSlug: string; teamName: string; initialPage: MediaPage; tabs: MediaTab[] }) {
  const { page, pagination } = useMediaPages(teamSlug, "videos", initialPage, tabs);
  return <FanVideoFeed teamSlug={teamSlug} teamName={teamName} videos={page.videos} pagination={pagination} />;
}
