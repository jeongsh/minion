"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { AdSlot } from "@/components/ui/ad-slot";
import { hasReadyAdContent } from "@/components/ads/ad-runtime";
import { isAutoAdContentPath, isRailAdContentPath } from "@/lib/ads-policy";

// Temporary local preview uses the real rail geometry without requesting ads.
const PREVIEW_RAILS = process.env.NODE_ENV === "development";

function RailPreview({ className }: { className: string }) {
  return <aside aria-label="임시 광고 영역" className={`${className} flex flex-col items-center justify-center gap-2 border border-dashed border-[var(--ui-muted)] bg-[var(--ui-card-bg)] text-[13px] font-medium text-[var(--ui-ink)]`}>
    <span>임시 광고 영역</span>
    <span className="min-[2080px]:hidden">160 × 600</span>
    <span className="hidden min-[2080px]:inline">300 × 600</span>
  </aside>;
}

/** Only the right placement follows scrolling. */
export function DesktopAdRails() {
  const pathname = usePathname();
  const [contentPath, setContentPath] = useState<string | null>(null);
  const [secondaryHeaderHeight, setSecondaryHeaderHeight] = useState(0);
  const [railStart, setRailStart] = useState(0);
  const [stickyFits, setStickyFits] = useState(false);
  const allowed = PREVIEW_RAILS || isAutoAdContentPath(pathname) || isRailAdContentPath(pathname);

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
      const hasContent = PREVIEW_RAILS || hasReadyAdContent();
      setContentPath(hasContent && (PREVIEW_RAILS || !document.querySelector('[data-ads-blocked="true"]')) ? pathname : null);
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
      <div className="desktop-ad-rail-left-track">
        {PREVIEW_RAILS ? <RailPreview className="desktop-ad-rail desktop-ad-rail-left" /> : <AdSlot key={`${pathname}-left`} enabled placement="rail-left" className="desktop-ad-rail desktop-ad-rail-left" />}
      </div>
      <div className="desktop-ad-rail-track">
        {PREVIEW_RAILS ? <RailPreview className="desktop-ad-rail desktop-ad-rail-right" /> : <AdSlot key={`${pathname}-right`} enabled placement="rail-right" className="desktop-ad-rail desktop-ad-rail-right" />}
      </div>
    </div>
  );
}
