"use client";

import { useEffect, useRef } from "react";

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
  enabled = true,
}: {
  className?: string;
  placement?: AdPlacement;
  format?: "auto" | "horizontal" | "rectangle";
  enabled?: boolean;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const initializedRef = useRef(false);
  const slot = slotFor(placement);
  const configured = enabled && Boolean(AD_CLIENT && slot);
  const resolvedFormat = format ?? (placement === "horizontal" ? "horizontal" : "rectangle");

  useEffect(() => {
    const container = containerRef.current;
    if (!configured || !container || initializedRef.current) return;

    const requestAd = () => {
      const { width, height } = container.getBoundingClientRect();
      if (initializedRef.current || width < 120 || height < 50) return;

      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        initializedRef.current = true;
      } catch {
        // Ad blockers and preview environments may reject the request.
      }
    };

    requestAd();
    const observer = new ResizeObserver(requestAd);
    observer.observe(container);
    return () => observer.disconnect();
  }, [configured]);

  if (!enabled || (!configured && !SHOW_PLACEHOLDER)) return null;

  return (
    <aside
      ref={containerRef}
      aria-label="광고"
      className={`min-w-0 ${configured ? "" : "grid place-items-center rounded-[var(--ui-card-radius)] bg-[var(--ui-ad-surface)] text-[11px] font-medium tracking-[.18em] text-[#96999f]"} ${className}`}
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
