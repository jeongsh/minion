"use client";

import { Play } from "lucide-react";
import { useState } from "react";

import type { MatchVod } from "@/lib/types";

function providerLabel(provider: string | null) {
  if (provider === "afreecatv") return "SOOP";
  if (provider === "youtube") return "YouTube";
  return "다시보기";
}

function SetThumbnail({ vod }: { vod: MatchVod }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
      {vod.thumbnailUrl ? (
        // 외부 CDN 이미지라 next/image 대신 img 를 쓴다.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vod.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full place-items-center text-white/70">
          <Play className="h-5 w-5" />
        </span>
      )}
    </div>
  );
}

export function SetVodPlayer({ vods, matchName }: { vods: MatchVod[]; matchName: string }) {
  const [activeSet, setActiveSet] = useState(vods[0]?.setNumber ?? 1);
  const active = vods.find((vod) => vod.setNumber === activeSet) ?? vods[0];

  if (!active) return null;

  return (
    <div className="grid gap-5 min-[1200px]:grid-cols-[minmax(0,1fr)_320px] min-[1200px]:items-start">
      <div className="min-w-0">
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          {active.embedUrl ? (
            <iframe
              key={active.embedUrl}
              src={active.embedUrl}
              title={`${matchName} ${active.setNumber}세트 다시보기`}
              className="h-full w-full border-0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            // 내부 재생이 불가능한 제공처는 썸네일을 눌러 새 창으로 보낸다.
            <a href={active.url} target="_blank" rel="noreferrer noopener" className="relative block h-full w-full">
              {active.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
              <span className="absolute inset-0 grid place-items-center text-white">
                <Play className="h-14 w-14 fill-white" />
              </span>
            </a>
          )}
        </div>
        <p className="mt-2.5 text-base font-bold">{active.setNumber}세트</p>
      </div>

      <aside className="flex min-w-0 flex-col">
        <h3 className="mb-3 text-[15px] font-bold">세트별 다시보기</h3>
        <div className="grid gap-2.5 min-[1200px]:max-h-[520px] min-[1200px]:overflow-y-auto min-[1200px]:pr-1">
          {vods.map((vod) => {
            const selected = vod.setNumber === active.setNumber;

            return (
              <button
                key={vod.setNumber}
                type="button"
                onClick={() => setActiveSet(vod.setNumber)}
                aria-pressed={selected}
                className={`group grid grid-cols-[140px_minmax(0,1fr)] gap-2.5 rounded-lg p-1 text-left transition-colors ${
                  selected ? "bg-surface-muted" : "hover:bg-surface-muted"
                }`}
              >
                <SetThumbnail vod={vod} />
                <div className="min-w-0 self-center">
                  <p className={`text-[15px] font-bold leading-5 ${selected ? "text-accent" : "group-hover:text-accent"}`}>
                    {vod.setNumber}세트
                  </p>
                  <p className="mt-1 truncate text-[13px] text-muted">{providerLabel(vod.provider)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
