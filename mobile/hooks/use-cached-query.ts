import { useCallback, useEffect, useState } from 'react';

import { fetchMobileApi, readApiCache, writeApiCache } from '@/lib/api-client';

export function useCachedQuery<T>(path: string, options: { enabled?: boolean; cache?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const cache = options.cache ?? true;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  const refresh = useCallback(() => setRequestVersion((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      setError(null);
      const cached = cache ? await readApiCache<T>(path) : null;
      if (active && cached) {
        setData(cached.data);
        setLoading(false);
        setRefreshing(true);
      } else if (active) setLoading(true);
      try {
        const next = await fetchMobileApi<T>(path, controller.signal);
        if (!active) return;
        setData(next);
        if (cache) void writeApiCache(path, next);
      } catch (caught) {
        if (active && !controller.signal.aborted) setError(caught instanceof Error ? caught.message : '데이터를 불러오지 못했습니다.');
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [cache, enabled, path, requestVersion]);

  return { data, error, loading, refresh, refreshing };
}
