"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { canRequestAd, loadAdScript } from "@/components/ads/ad-runtime";
import { isRailAdContentPath } from "@/lib/ads-policy";

const AD_CLIENT = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;

/** Marks eligible content on pages without an inline manual placement. */
export function RailAdContent({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const marker = useRef<HTMLSpanElement>(null);
  const allowed = enabled && Boolean(AD_CLIENT) && isRailAdContentPath(pathname);

  useEffect(() => {
    const element = marker.current;
    if (!allowed || !element) return;
    element.dataset.adReady = "true";
    // Match the manual rails. Hidden desktop placements must not load ads on phones.
    const desktop = window.matchMedia(`(min-width: ${pathname === "/schedule" ? 1440 : 1800}px) and (hover: hover)`);
    const requestRails = () => {
      if (!desktop.matches || !marker.current || !canRequestAd(marker.current)) return;
      void loadAdScript(AD_CLIENT!).catch(() => {
        // Ad blockers may reject the script; content remains usable.
      });
    };
    requestRails();
    desktop.addEventListener("change", requestRails);
    return () => {
      delete element.dataset.adReady;
      desktop.removeEventListener("change", requestRails);
    };
  }, [allowed, pathname]);

  return allowed ? <span ref={marker} hidden data-ad-page={pathname} data-ad-content="true" /> : null;
}
