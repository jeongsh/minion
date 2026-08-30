"use client";

import { useEffect, useState } from "react";

type ThumbnailState = { pending: boolean; src: string | null };

const resolved = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function load(articleUrl: string): Promise<string | null> {
  const existing = inflight.get(articleUrl);
  if (existing) return existing;

  const request = fetch(`/api/news/thumbnail/resolve?url=${encodeURIComponent(articleUrl)}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { thumbnail: string | null } | null) => body?.thumbnail ?? null)
    .catch(() => null)
    .then((src) => {
      resolved.set(articleUrl, src);
      inflight.delete(articleUrl);
      return src;
    });

  inflight.set(articleUrl, request);
  return request;
}

/**
 * 뉴스 카드 썸네일을 렌더 후 개별 해석한다. 목록 응답이 원문 스크래핑을 기다리지 않도록 분리한다.
 * `initialSrc`가 있으면(예: 홈 피드) 즉시 사용하고 추가 요청하지 않는다.
 */
export function useNewsThumbnail(articleUrl: string, initialSrc?: string | null): ThumbnailState {
  const [state, setState] = useState<ThumbnailState>(() => {
    if (initialSrc) return { pending: false, src: initialSrc };
    if (resolved.has(articleUrl)) return { pending: false, src: resolved.get(articleUrl) ?? null };
    return { pending: true, src: null };
  });

  useEffect(() => {
    if (!state.pending) return;
    let active = true;
    void load(articleUrl).then((src) => {
      if (active) setState({ pending: false, src });
    });
    return () => {
      active = false;
    };
  }, [articleUrl, state.pending]);

  return state;
}
