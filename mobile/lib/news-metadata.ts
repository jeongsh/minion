import { fetchMobileQuery } from '@/lib/api-client';

type NewsMetadata = { title?: string | null; thumbnail?: string | null };

/** Home and the news list share one cancellable request and short-lived cache. */
export function resolveNewsMetadata(kind: 'title' | 'thumbnail', url: string, signal: AbortSignal) {
  const path = `/api/mobile/v1/news/article?kind=${kind}&url=${encodeURIComponent(url)}`;
  return fetchMobileQuery<NewsMetadata>(path, path, 'memory', false, { signal, cancelOnUnused: true, staleTimeMs: 60_000 });
}
