"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isAdContentPath } from "@/lib/ads-policy";
import { canRequestAd, loadAdScript } from "@/components/ads/ad-runtime";

export type AdPlacement =
  | "horizontal"
  | "rectangle"
  | "community"
  | "prediction";

const AD_CLIENT = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;
const SHOW_PLACEHOLDER =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ADSENSE_SHOW_PLACEHOLDERS === "true";

function slotFor(placement: AdPlacement) {
  if (placement === "horizontal") return process.env.NEXT_PUBLIC_ADSENSE_SLOT_HORIZONTAL;
  if (placement === "rectangle") return process.env.NEXT_PUBLIC_ADSENSE_SLOT_RECTANGLE;
  if (placement === "community") return process.env.NEXT_PUBLIC_ADSENSE_SLOT_COMMUNITY;
  return process.env.NEXT_PUBLIC_ADSENSE_SLOT_PREDICTION;
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export function AdSlot({
  className = "",
  placement = "horizontal",
  format,
  enabled = false,
}: {
  className?: string;
  placement?: AdPlacement;
  format?: "auto" | "horizontal" | "rectangle";
  enabled?: boolean;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const initializedRef = useRef(false);
  const pathname = usePathname();
  const allowed = enabled && isAdContentPath(pathname);
  const slot = slotFor(placement);
  const configured = allowed && Boolean(AD_CLIENT && slot);
  const resolvedFormat = format ?? (placement === "horizontal" ? "horizontal" : "rectangle");

  useEffect(() => {
    const container = containerRef.current;
    if (!configured || !container || initializedRef.current) return;

    let disposed = false;
    let pending = false;
    const requestAd = async () => {
      const { width, height } = container.getBoundingClientRect();
      if (disposed || pending || initializedRef.current || width < 120 || height < 50 || !canRequestAd(container)) return;

      pending = true;
      try {
        await loadAdScript(AD_CLIENT!);
        const currentSize = container.getBoundingClientRect();
        if (disposed || !canRequestAd(container) || currentSize.width < 120 || currentSize.height < 50) return;
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        initializedRef.current = true;
      } catch {
        // Ad blockers and preview environments may reject the request.
      } finally {
        pending = false;
      }
    };

    requestAd();
    const observer = new ResizeObserver(requestAd);
    observer.observe(container);
    return () => { disposed = true; observer.disconnect(); };
  }, [configured, pathname]);

  if (!allowed || (!configured && !SHOW_PLACEHOLDER)) return null;

  return (
    <aside
      ref={containerRef}
      data-ad-page={pathname}
      data-ad-content={configured ? "true" : undefined}
      aria-label="광고"
      className={`min-w-0 ${configured ? "" : "grid place-items-center rounded-[var(--ui-card-radius)] bg-[var(--ui-ad-surface)] text-[12px] font-medium tracking-[.18em] text-[#96999f]"} ${className}`}
    >
      {configured ? (
        <ins
          className="adsbygoogle block h-full w-full"
          data-ad-client={AD_CLIENT}
          data-ad-slot={slot}
          data-ad-format={resolvedFormat}
          data-full-width-responsive={resolvedFormat === "auto" ? "true" : "false"}
        />
      ) : (
        "ADVERTISEMENT"
      )}
    </aside>
  );
}
