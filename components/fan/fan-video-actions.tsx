"use client";

import { Check, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function FanVideoActions({ videoUrl }: { videoUrl: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const currentUrl = window.location.href;

    if (navigator.share) {
      await navigator.share({ title: document.title, url: currentUrl }).catch(() => undefined);
      return;
    }

    await navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={share}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-[#f2f2f2] px-4 text-sm font-semibold text-[#0f0f0f] transition hover:bg-[#e5e5e5]"
      >
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {copied ? "링크 복사됨" : "공유"}
      </button>
      <Link
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 items-center rounded-full bg-[#ff0033] px-5 text-sm font-semibold text-white transition hover:bg-[#d9002b]"
      >
        YouTube에서 보기
      </Link>
    </div>
  );
}
