"use client";

import { useState } from "react";
import { InstagramIcon, InstagramPostModal, proxyUrl } from "@/components/fan/instagram-post-modal";
import type { FeedInstaItem } from "@/components/fan/fan-feed-mosaic";

export function FanSocialPreview({ items }: { items: FeedInstaItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return <>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.slice(0, 6).map((item, index) => <button key={item.id} type="button" onClick={() => setOpenIndex(index)} className="group relative aspect-square overflow-hidden rounded-2xl bg-[#f1f2f4] text-left">
        {item.imageUrl ? <img src={proxyUrl(item.imageUrl)} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/> : null}
        <InstagramIcon className="absolute right-3 top-3 h-5 w-5 text-white drop-shadow"/>
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 px-3 pb-3 pt-8 text-xs font-bold text-white">{item.ownerName}</span>
      </button>)}
    </div>
    {openIndex !== null ? <InstagramPostModal items={items} startIndex={openIndex} onClose={() => setOpenIndex(null)}/> : null}
  </>;
}
