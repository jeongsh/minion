"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { canRequestAd, loadAdScript } from "@/components/ads/ad-runtime";
import { isAutoAdContentPath } from "@/lib/ads-policy";

const AD_CLIENT = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;

/** Auto ads need a publisher ID and content, independently of manual ad units. */
export function AutoAdContent({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const marker = useRef<HTMLSpanElement>(null);
  const allowed = enabled && Boolean(AD_CLIENT) && isAutoAdContentPath(pathname);

  useEffect(() => {
    if (!allowed || !marker.current || !canRequestAd(marker.current)) return;
    void loadAdScript(AD_CLIENT!).catch(() => {
      // Ad blockers and preview environments may reject the request.
    });
  }, [allowed, pathname]);

  return allowed ? <span ref={marker} hidden data-ad-page={pathname} data-ad-content="true" /> : null;
}
