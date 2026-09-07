"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { canRequestAd, loadAdScript } from "@/components/ads/ad-runtime";
import { isRailAdContentPath } from "@/lib/ads-policy";

const AD_CLIENT = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;

/** Allows Auto ads without creating a manual slot. Select side rails in AdSense. */
export function RailAdContent({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const marker = useRef<HTMLSpanElement>(null);
  const allowed = enabled && Boolean(AD_CLIENT) && isRailAdContentPath(pathname);

  useEffect(() => {
    if (!allowed || !marker.current || !canRequestAd(marker.current)) return;
    void loadAdScript(AD_CLIENT!).catch(() => {
      // Ad blockers may reject the script; content remains usable.
    });
  }, [allowed, pathname]);

  return allowed ? <span ref={marker} hidden data-ad-page={pathname} data-ad-content="true" /> : null;
}
