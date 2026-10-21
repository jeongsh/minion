"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdSlot } from "@/components/ui/ad-slot";
import { isAutoAdContentPath, isRailAdContentPath } from "@/lib/ads-policy";

/** Ordinary scrolling placements: AdSense forbids mirrored sticky units. */
export function DesktopAdRails() {
  const pathname = usePathname();
  const [contentPath, setContentPath] = useState<string | null>(null);
  const allowed = isAutoAdContentPath(pathname) || isRailAdContentPath(pathname);

  useEffect(() => {
    if (!allowed) return;
    const update = () => {
      const hasContent = Array.from(document.querySelectorAll<HTMLElement>('[data-ad-content="true"]'))
        .some((element) => element.dataset.adPage === pathname);
      setContentPath(hasContent && !document.querySelector('[data-ads-blocked="true"]') ? pathname : null);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-ad-content", "data-ad-page", "data-ads-blocked"],
    });
    return () => observer.disconnect();
  }, [allowed, pathname]);

  if (!allowed || contentPath !== pathname) return null;

  return (
    <div className="desktop-ad-rails">
      <AdSlot key={`${pathname}-left`} enabled placement="rail-left" className="desktop-ad-rail desktop-ad-rail-left" />
      <AdSlot key={`${pathname}-right`} enabled placement="rail-right" className="desktop-ad-rail desktop-ad-rail-right" />
    </div>
  );
}
