"use client";

import { useCallback, useRef, useState } from "react";
import type { MediaKind, MediaPage, MediaTab } from "@/lib/fan/media-feed";

export type MediaPagination = { tabs: MediaTab[]; owner: string; select: (owner: string) => void; loadMore: () => Promise<void>; hasMore: boolean; loading: boolean; error: string | null };
const empty: MediaPage = { videos: [], teamPosts: [], playerPosts: [], next: null };

export function useMediaPages(teamSlug: string, kind: MediaKind, initial: MediaPage, tabs: MediaTab[]) {
  const [owner, setOwner] = useState("all");
  const [pages, setPages] = useState<Record<string, MediaPage>>({ all: initial });
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const requests = useRef(new Set<string>());
  const read = useCallback(async (key: string, current?: MediaPage) => {
    if (requests.current.has(key)) return;
    requests.current.add(key);
    setPending(previous => new Set(previous).add(key));
    setErrors(previous => ({ ...previous, [key]: null }));
    try {
      const query = new URLSearchParams({ kind, owner: key, team: String(current?.next?.team ?? 0), player: String(current?.next?.player ?? 0) });
      const response = await fetch(`/api/fan/${encodeURIComponent(teamSlug)}/feed?${query}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("목록을 불러오지 못했습니다. 다시 시도해 주세요.");
      const page: MediaPage = await response.json();
      const unique = <T extends { id: string }>(rows: T[]) => [...new Map(rows.map(item => [item.id, item])).values()];
      setPages(previous => ({ ...previous, [key]: { next: page.next, videos: unique([...(current?.videos ?? []), ...page.videos]), teamPosts: unique([...(current?.teamPosts ?? []), ...page.teamPosts]), playerPosts: unique([...(current?.playerPosts ?? []), ...page.playerPosts]) } }));
    } catch (error) {
      setErrors(previous => ({ ...previous, [key]: error instanceof Error ? error.message : "목록을 불러오지 못했습니다." }));
    } finally {
      requests.current.delete(key);
      setPending(previous => { const next = new Set(previous); next.delete(key); return next; });
    }
  }, [kind, teamSlug]);
  const page = pages[owner] ?? empty;
  const pagination: MediaPagination = { tabs, owner, loading: pending.has(owner), error: errors[owner] ?? null, hasMore: Boolean(page.next),
    select(key) { setOwner(key); if (!pages[key]) void read(key); },
    loadMore() { return read(owner, pages[owner]); },
  };
  return { page, pagination };
}
