"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isAdContentPath, isRailAdContentPath } from "@/lib/ads-policy";

let scriptPromise: Promise<void> | undefined;
let adDocumentUrl: string | undefined;

function documentUrl() {
  return window.location.origin + window.location.pathname + window.location.search;
}

export function canRequestAd(element: HTMLElement): boolean {
  return element.isConnected
    && element.dataset.adPage === window.location.pathname
    && (isAdContentPath(window.location.pathname) || isRailAdContentPath(window.location.pathname))
    && !document.querySelector('[data-ads-blocked="true"]')
    && (!adDocumentUrl || adDocumentUrl === documentUrl());
}

export function loadAdScript(client: string): Promise<void> {
  if (!scriptPromise) {
    adDocumentUrl = documentUrl();
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.id = "google-adsense";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Ad script unavailable"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** Removing a script tag cannot unload Auto ads. Leave its document instead. */
export function AdDocumentBoundary() {
  const pathname = usePathname();
  useEffect(() => {
    if (adDocumentUrl && adDocumentUrl !== documentUrl()) window.location.reload();
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!adDocumentUrl || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(url.href);
    };
    const checkDocument = () => {
      if (!adDocumentUrl) return;
      if (adDocumentUrl !== documentUrl() || document.querySelector('[data-ads-blocked="true"]') || !document.querySelector('[data-ad-content="true"]')) {
        window.location.reload();
      }
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", checkDocument);
    const observer = new MutationObserver(checkDocument);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ad-content", "data-ads-blocked"] });
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", checkDocument);
      observer.disconnect();
    };
  }, []);
  return null;
}
