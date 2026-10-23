"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { TournamentLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

const entries = new Map<string, ReactNode>();
const listeners = new Set<() => void>();
const queryKeys = ["year", "split", "phase", "view", "bracketStage"];

function keyFor(pathname: string, search: URLSearchParams) {
  const query = new URLSearchParams();
  for (const key of queryKeys) {
    const value = search.get(key);
    if (value) query.set(key, value);
  }
  query.sort();
  return pathname + (query.size ? "?" + query.toString() : "");
}

function readEntry(pathname: string, search: URLSearchParams) {
  const exact = entries.get(keyFor(pathname, search));
  if (exact) return exact;
  // The menu redirects /tournaments to the current event. Keep the last event
  // visible while that redirect and its fresh server response are in flight.
  if (pathname !== "/tournaments" && search.size > 0) return undefined;
  for (const [key, content] of Array.from(entries).reverse()) {
    const url = new URL(key, "https://minion.fan");
    if (pathname !== "/tournaments" && pathname !== url.pathname) continue;
    if (queryKeys.some(name => search.has(name) && search.get(name) !== url.searchParams.get(name))) continue;
    return content;
  }
  return undefined;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function TournamentContentCache({ cacheKey, children }: { cacheKey: string; children: ReactNode }) {
  const router = useRouter();
  const previousVisit = useRef(entries.has(cacheKey));
  useEffect(() => {
    entries.delete(cacheKey);
    entries.set(cacheKey, children);
    while (entries.size > 12) entries.delete(entries.keys().next().value!);
    listeners.forEach(listener => listener());
  }, [cacheKey, children]);
  useEffect(() => {
    if (previousVisit.current) {
      previousVisit.current = false;
      router.refresh();
    }
  }, [router]);
  return children;
}

function PendingContent() {
  const pathname = usePathname();
  const search = useSearchParams();
  const content = useSyncExternalStore(subscribe, () => readEntry(pathname, new URLSearchParams(search.toString())), () => undefined);
  if (!content) return <TournamentLoadingSkeleton />;
  return <div data-tournament-cached="true" data-route-loading="true">{content}</div>;
}

export function TournamentPendingContent() {
  return <Suspense fallback={<TournamentLoadingSkeleton />}><PendingContent /></Suspense>;
}

export function TournamentEntryFallback() {
  const anchor = useRef<HTMLDivElement>(null);
  const [hasContent, setHasContent] = useState(false);
  useEffect(() => {
    const content = anchor.current?.parentElement?.querySelector(".tournament-entry-content");
    if (!content) return;
    const update = () => setHasContent(Boolean(content.querySelector("main:not(:empty):not([hidden] *)")));
    const observer = new MutationObserver(update);
    observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    const frame = requestAnimationFrame(update);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return <div ref={anchor} className="tournament-entry-fallback">{hasContent ? null : <TournamentPendingContent />}</div>;
}
