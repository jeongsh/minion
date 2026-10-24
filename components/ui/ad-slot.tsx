"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isAdContentPath, isAutoAdContentPath, isRailAdContentPath } from "@/lib/ads-policy";
import { canRequestAd, loadAdScript } from "@/components/ads/ad-runtime";
import { AutoAdContent } from "@/components/ads/auto-ad-content";

export type AdPlacement =
  | "horizontal"
  | "rectangle"
  | "community"
  | "rail-left"
  | "rail-right"
  | "prediction";

const AD_CLIENT = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;
const SHOW_PLACEHOLDER =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ADSENSE_SHOW_PLACEHOLDERS === "true";

function slotFor(placement: AdPlacement) {
  if (placement === "rail-left") return process.env.NEXT_PUBLIC_ADSENSE_SLOT_RAIL_LEFT || "8132559232";
  if (placement === "rail-right") return process.env.NEXT_PUBLIC_ADSENSE_SLOT_RAIL_RIGHT || "1053426821";
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
  format?: "auto" | "horizontal" | "rectangle" | "vertical";
  enabled?: boolean;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const initializedRef = useRef(false);
  const [unfilled, setUnfilled] = useState(false);
  const pathname = usePathname();
  const isRail = placement === "rail-left" || placement === "rail-right";
  const allowed = enabled && (isRail
    ? isAutoAdContentPath(pathname) || isRailAdContentPath(pathname)
    : isAdContentPath(pathname));
  const slot = slotFor(placement);
  const configured = allowed && Boolean(AD_CLIENT && slot);
  const resolvedFormat = format ?? (isRail ? "vertical" : placement === "horizontal" ? "horizontal" : "rectangle");

  useEffect(() => {
    const container = containerRef.current;
    if (!configured || !container || initializedRef.current) return;

    let disposed = false;
    let pending = false;
    const statusObserver = new MutationObserver(() => {
      setUnfilled(container.querySelector("ins")?.dataset.adStatus === "unfilled");
    });
    statusObserver.observe(container, { subtree: true, attributes: true, attributeFilter: ["data-ad-status"] });
    const requestAd = async () => {
      const { width, height } = container.getBoundingClientRect();
      if (disposed || pending || initializedRef.current || width < 120 || height < 50 || !canRequestAd(container)) return;

      pending = true;
      try {
        await loadAdScript(AD_CLIENT!);
        const currentSize = container.getBoundingClientRect();
        if (disposed || !canRequestAd(container) || currentSize.width < 120 || currentSize.height < 50) return;
        // push({}) consumes the first unprocessed ins in the document. Keep
        // hidden placements out of that queue, then insert and request together.
        const ad = document.createElement("ins");
        ad.className = "adsbygoogle block h-full w-full";
        ad.style.cssText = `display: block; width: 100%; height: ${currentSize.height}px;`;
        ad.dataset.adClient = AD_CLIENT!;
        ad.dataset.adSlot = slot!;
        container.appendChild(ad);
        window.adsbygoogle = window.adsbygoogle || [];
        try {
          window.adsbygoogle.push({});
        } catch (error) {
          if (!ad.dataset.adsbygoogleStatus) ad.remove();
          else initializedRef.current = true;
          throw error;
        }
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
    // Content can become ready after this slot's first effect without resizing.
    const contentObserver = new MutationObserver(requestAd);
    contentObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-ad-ready", "data-ads-blocked"] });
    return () => { disposed = true; observer.disconnect(); statusObserver.disconnect(); contentObserver.disconnect(); };
  }, [configured, pathname, slot]);

  if (!allowed) return null;
  // Rails follow the page's own content marker; they must never opt themselves in.
  const autoContent = isRail ? null : <AutoAdContent enabled={allowed} />;
  if (!configured && !SHOW_PLACEHOLDER) return autoContent;

  return (
    <>
      {autoContent}
      <aside
        ref={containerRef}
        data-ad-page={pathname}
        data-ad-content={!isRail ? "true" : undefined}
        data-ad-placement={placement}
        aria-label="광고"
        style={unfilled ? { display: "none" } : undefined}
        className={`min-w-0 ${resolvedFormat !== "rectangle" && !isRail ? "max-md:!h-[100px]" : ""} ${configured ? "" : "grid place-items-center rounded-[var(--ui-card-radius)] bg-[var(--ui-ad-surface)] text-[12px] font-medium tracking-[.18em] text-[#96999f]"} ${className}`}
      >
        {configured ? null : "ADVERTISEMENT"}
      </aside>
    </>
  );
}
