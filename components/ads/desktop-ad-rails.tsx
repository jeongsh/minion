"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { AdSlot } from "@/components/ui/ad-slot";
import { hasReadyAdContent } from "@/components/ads/ad-runtime";
import { isAutoAdContentPath, isRailAdContentPath } from "@/lib/ads-policy";

/** Only the right placement sticks: AdSense forbids mirrored sticky units. */
export function DesktopAdRails() {
  const pathname = usePathname();
  const [contentPath, setContentPath] = useState<string | null>(null);
  const [secondaryHeaderHeight, setSecondaryHeaderHeight] = useState(0);
  const [railStart, setRailStart] = useState(0);
  const [stickyFits, setStickyFits] = useState(false);
  const allowed = isAutoAdContentPath(pathname) || isRailAdContentPath(pathname);

  useEffect(() => {
    if (!allowed) return;
    const observedHeaders = new Set<Element>();
    const update = () => {
      const headers = Array.from(document.querySelectorAll<HTMLElement>('[data-ad-secondary-header]'));
      const railStarts = Array.from(document.querySelectorAll<HTMLElement>('[data-ad-rail-start]'));
      let headerHeight = 0;
      for (const header of [...headers, ...railStarts]) {
        if (!observedHeaders.has(header)) {
          observedHeaders.add(header);
          resizeObserver.observe(header);
        }
        if (header.matches('[data-ad-secondary-header]')) {
          headerHeight = Math.max(headerHeight, header.getBoundingClientRect().height);
        }
      }
      const layout = document.querySelector<HTMLElement>('.ad-rail-layout');
      setRailStart(layout ? Math.max(0, ...railStarts.map((header) =>
        header.getBoundingClientRect().bottom - layout.getBoundingClientRect().top + 24,
      )) : 0);
      for (const header of observedHeaders) {
        if (!header.isConnected) {
          resizeObserver.unobserve(header);
          observedHeaders.delete(header);
        }
      }
      setSecondaryHeaderHeight(headerHeight);
      setStickyFits(window.innerHeight >= 700 + headerHeight);
      const hasContent = hasReadyAdContent();
      setContentPath(hasContent && !document.querySelector('[data-ads-blocked="true"]') ? pathname : null);
    };
    const resizeObserver = new ResizeObserver(update);
    update();
    window.addEventListener("resize", update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-ad-content", "data-ad-page", "data-ad-ready", "data-ads-blocked"],
    });
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [allowed, pathname]);

  if (!allowed || contentPath !== pathname) return null;

  return (
    <div
      className="desktop-ad-rails"
      data-sticky-fits={stickyFits}
      style={{
        "--ad-secondary-header-height": `${secondaryHeaderHeight}px`,
        "--ad-rail-start": `${railStart}px`,
      } as CSSProperties}
    >
      <AdSlot key={`${pathname}-left`} enabled placement="rail-left" className="desktop-ad-rail desktop-ad-rail-left" />
      <div className="desktop-ad-rail-track">
        <AdSlot key={`${pathname}-right`} enabled placement="rail-right" className="desktop-ad-rail desktop-ad-rail-right" />
      </div>
    </div>
  );
}
