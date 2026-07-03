"use client";

import Link from "next/link";
import { useState } from "react";

import {
  InstagramIcon,
  InstagramPostModal,
  type InstagramPostItem,
  proxyUrl,
  relativeTime,
} from "@/components/fan/instagram-post-modal";

// ─── 타입 ──────────────────────────────────────────────────────

export type FeedVideoItem = {
  id: string;
  routeId: string;
  title: string;
  ownerName: string;
  thumbnailUrl: string;
  publishedAt: string;
};

export type FeedInstaItem = InstagramPostItem;

type MergedItem =
  | { kind: "video"; time: number; video: FeedVideoItem }
  | { kind: "insta"; time: number; insta: FeedInstaItem; instaIndex: number };

// ─── 카드 ──────────────────────────────────────────────────────

const HATCH = "repeating-linear-gradient(45deg, #f4f2ee 0 12px, #edeae5 12px 24px)";

function cardShell(extra = "") {
  return `group relative block aspect-square overflow-hidden rounded-[14px] bg-[#edeae5] transition duration-150 ease-out hover:-translate-y-[3px] hover:shadow-[0_14px_30px_rgba(60,50,60,0.14)] ${extra}`;
}

function MediaBg({ src }: { src?: string }) {
  if (!src) return <span className="absolute inset-0" style={{ background: HATCH }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
    />
  );
}

function VideoCell({ video, teamSlug, teamColor }: { video: FeedVideoItem; teamSlug: string; teamColor: string }) {
  return (
    <Link href={`/fan/${teamSlug}/videos/${encodeURIComponent(video.routeId)}`} className={cardShell()}>
      <MediaBg src={video.thumbnailUrl} />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition group-hover:scale-110">
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col gap-[3px] px-[18px] py-4 text-white"
        style={{ background: "linear-gradient(transparent, rgba(20,18,24,0.82))" }}
      >
        <span
          className="font-archivo self-start rounded-[3px] px-[7px] py-[3px] text-[10px] font-black"
          style={{ background: teamColor }}
        >
          영상
        </span>
        <span className="text-[14px] font-black leading-snug line-clamp-2">{video.title}</span>
        <span className="text-[11px] font-semibold text-white/75">
          {video.ownerName} · <span suppressHydrationWarning>{relativeTime(video.publishedAt)}</span>
        </span>
      </div>
    </Link>
  );
}

function InstaCell({ item, onOpen }: { item: FeedInstaItem; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={cardShell("text-left")}>
      <MediaBg src={proxyUrl(item.imageUrl)} />
      <span className="absolute right-3 top-3 text-white/90 drop-shadow">
        <InstagramIcon className="h-[18px] w-[18px]" />
      </span>
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col gap-[3px] px-4 py-[14px] text-white"
        style={{ background: "linear-gradient(transparent, rgba(20,18,24,0.78))" }}
      >
        <span className="text-[13px] font-extrabold leading-snug line-clamp-2">
          {item.caption || "Instagram"}
        </span>
        <span className="text-[11px] font-semibold text-white/75">
          @{item.ownerName} · <span suppressHydrationWarning>{relativeTime(item.postedAt)}</span>
        </span>
      </div>
    </button>
  );
}

function AdCell() {
  return (
    <div className="grid aspect-square place-items-center rounded-[14px] border-[1.5px] border-dashed border-[#d8d5cf] bg-[#faf9f7]">
      <span className="font-mono text-xs text-[#9a968f]">광고영역</span>
    </div>
  );
}

// ─── 메인 ──────────────────────────────────────────────────────

export function FanFeedMosaic({
  videos,
  insta,
  teamSlug,
  teamColor,
}: {
  videos: FeedVideoItem[];
  insta: FeedInstaItem[];
  teamSlug: string;
  teamColor: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // 영상 + 인스타를 시간순(최신 우선)으로 병합한다.
  const merged: MergedItem[] = [
    ...videos.map((video) => ({
      kind: "video" as const,
      time: video.publishedAt ? new Date(video.publishedAt).getTime() : 0,
      video,
    })),
    ...insta.map((item, instaIndex) => ({
      kind: "insta" as const,
      time: item.postedAt ? new Date(item.postedAt).getTime() : 0,
      insta: item,
      instaIndex,
    })),
  ].sort((a, b) => b.time - a.time);

  // 콘텐츠 7개 + 5번째 위치에 광고 = 2행(8칸).
  const content = merged.slice(0, 7);
  const cells: (MergedItem | { kind: "ad" })[] = [...content];
  cells.splice(4, 0, { kind: "ad" });

  return (
    <div className="flex flex-col gap-[18px] px-10">
      <div className="flex items-baseline gap-[14px] border-b-2 border-[#16151b] pb-[10px]">
        <h2 className="font-archivo m-0 text-[26px] font-black tracking-[-0.01em]">FEED</h2>
        <span className="text-[13px] font-semibold text-[#8a8892]">오늘 새로 올라온 것</span>
        <div className="ml-auto flex gap-[8px]">
          <Link
            href={`/fan/${teamSlug}/videos`}
            className="rounded-full border border-[#e4e1db] px-[15px] py-[7px] text-xs font-extrabold text-[#4a4954] transition hover:border-[#16151b] hover:text-[#16151b]"
          >
            영상 →
          </Link>
          <Link
            href={`/fan/${teamSlug}/instagram`}
            className="rounded-full border border-[#e4e1db] px-[15px] py-[7px] text-xs font-extrabold text-[#4a4954] transition hover:border-[#16151b] hover:text-[#16151b]"
          >
            인스타 →
          </Link>
        </div>
      </div>

      {content.length === 0 ? (
        <div className="grid place-items-center rounded-[14px] border border-dashed border-[#e0ddd7] bg-[#faf9f7] py-16 text-sm text-[#9a968f]">
          아직 새 콘텐츠가 없어요.
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-[14px]">
          {cells.map((cell) => {
            if (cell.kind === "ad") return <AdCell key="ad" />;
            if (cell.kind === "video") {
              return <VideoCell key={cell.video.id} video={cell.video} teamSlug={teamSlug} teamColor={teamColor} />;
            }
            return (
              <InstaCell
                key={cell.insta.id}
                item={cell.insta}
                onOpen={() => setOpenIndex(cell.instaIndex)}
              />
            );
          })}
        </div>
      )}

      {openIndex !== null ? (
        <InstagramPostModal items={insta} startIndex={openIndex} onClose={() => setOpenIndex(null)} />
      ) : null}
    </div>
  );
}
