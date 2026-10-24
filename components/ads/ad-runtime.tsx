"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ADS_ENABLED, isAdContentPath, isAutoAdContentPath, isRailAdContentPath } from "@/lib/ads-policy";

let scriptPromise: Promise<void> | undefined;
let adDocumentUrl: string | undefined;
let leavingDocument = false;
const CONTENT_SETTLE_MS = 500;

function documentUrl() {
  // Filters within an editorial route share its ad document. Content markers
  // still force a clean document if a filter produces blocked/empty content.
  return window.location.origin + window.location.pathname;
}

export function hasReadyAdContent(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-ad-content="true"][data-ad-ready="true"]'))
    .some((element) => element.dataset.adPage === window.location.pathname
      && Boolean(element.parentElement?.getClientRects().length));
}

function pageIsLoading() {
  return document.readyState === "loading"
    || Array.from(document.querySelectorAll('[data-route-loading="true"]'))
      .some((element) => element.getClientRects().length > 0);
}

function reloadDocument() {
  if (leavingDocument) return;
  leavingDocument = true;
  window.location.reload();
}

export function canRequestAd(element: HTMLElement): boolean {
  return element.isConnected
    && !leavingDocument
    && element.dataset.adPage === window.location.pathname
    && (isAutoAdContentPath(window.location.pathname) || isRailAdContentPath(window.location.pathname))
    && !document.querySelector('[data-ads-blocked="true"]')
    && hasReadyAdContent()
    && (!adDocumentUrl || adDocumentUrl === documentUrl());
}

export function loadAdScript(client: string): Promise<void> {
  if (!ADS_ENABLED) return Promise.reject(new Error("Ads are disabled"));
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
export function AdDocumentBoundary({ prefetchDocuments = false }: { prefetchDocuments?: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    if (adDocumentUrl && adDocumentUrl !== documentUrl()) reloadDocument();
  }, [pathname]);

  useEffect(() => {
    let contentCheck: number | undefined;
    const clearContentCheck = () => {
      window.clearTimeout(contentCheck);
      contentCheck = undefined;
    };
    const onClick = (event: MouseEvent) => {
      if (!adDocumentUrl || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || url.pathname === location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      leavingDocument = true;
      window.location.assign(url.href);
    };
    const checkDocument = () => {
      if (!adDocumentUrl || leavingDocument) return;
      if (adDocumentUrl !== documentUrl()) {
        reloadDocument();
        return;
      }
      if (!document.querySelector('[data-ads-blocked="true"]') && hasReadyAdContent()) {
        clearContentCheck();
        return;
      }
      // Streaming and hydration recovery may temporarily replace the content.
      // Only leave a settled empty/error document, never its loading fallback.
      if (contentCheck !== undefined) return;
      contentCheck = window.setTimeout(() => {
        contentCheck = undefined;
        if (pageIsLoading()) return;
        if (document.querySelector('[data-ads-blocked="true"]') || !hasReadyAdContent()) reloadDocument();
      }, CONTENT_SETTLE_MS);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", checkDocument);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) leavingDocument = false;
      checkDocument();
    };
    const observer = new MutationObserver(checkDocument);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ad-content", "data-ad-ready", "data-ads-blocked"] });
    window.addEventListener("pageshow", onPageShow);
    return () => {
      clearContentCheck();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", checkDocument);
      window.removeEventListener("pageshow", onPageShow);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!ADS_ENABLED || !prefetchDocuments || !HTMLScriptElement.supports?.("speculationrules")) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || connection?.effectiveType?.includes("2g")) return;
    const scripts = new Map<string, HTMLScriptElement>();
    const prepare = (event: Event) => {
      if (!adDocumentUrl || scripts.size >= 2) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || !isAdContentPath(url.pathname) || scripts.has(url.href)) return;
      const script = document.createElement("script");
      script.type = "speculationrules";
      script.textContent = JSON.stringify({ prefetch: [{ urls: [url.href], eagerness: "moderate" }] });
      scripts.set(url.href, script);
      document.head.appendChild(script);
    };
    document.addEventListener("pointerover", prepare);
    document.addEventListener("pointerdown", prepare);
    document.addEventListener("focusin", prepare);
    return () => {
      document.removeEventListener("pointerover", prepare);
      document.removeEventListener("pointerdown", prepare);
      document.removeEventListener("focusin", prepare);
      for (const script of scripts.values()) script.remove();
    };
  }, [prefetchDocuments]);
  return null;
}
