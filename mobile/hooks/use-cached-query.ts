import { useCallback, useEffect, useState } from 'react';

import { fetchMobileApi, readApiCache, subscribeApiCacheInvalidation, writeApiCache } from '@/lib/api-client';

const NETWORK_ERROR_PATTERN = /failed to fetch|network request failed|load failed/i;

function userFacingError(error: unknown) {
  if (!(error instanceof Error) || !error.message) return '데이터를 불러오지 못했습니다.';
  if (NETWORK_ERROR_PATTERN.test(error.message)) return '네트워크 연결을 확인한 뒤 다시 시도해주세요.';
  return error.message;
}

export function useCachedQuery<T>(path: string, options: { enabled?: boolean; cache?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const cache = options.cache ?? true;
  const [data, setData] = useState<T | null>(null);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorPath, setErrorPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  const refresh = useCallback(() => setRequestVersion((value) => value + 1), []);

  useEffect(() => subscribeApiCacheInvalidation((pathPrefix) => {
    if (path.startsWith(pathPrefix)) refresh();
  }), [path, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      setError(null);
      setErrorPath(null);
      const cached = cache ? await readApiCache<T>(path) : null;
      if (active && cached) {
        setData(cached.data);
        setDataPath(path);
        setLoading(false);
        setRefreshing(true);
      } else if (active) setLoading(true);
      try {
        const next = await fetchMobileApi<T>(path, controller.signal);
        if (!active) return;
        setData(next);
        setDataPath(path);
        if (cache) void writeApiCache(path, next);
      } catch (caught) {
        if (active && !controller.signal.aborted) {
          setError(userFacingError(caught));
          setErrorPath(path);
        }
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

  const currentData = dataPath === path ? data : null;
  const currentError = errorPath === path ? error : null;
  const awaitingCurrentPath = enabled && currentData === null && currentError === null;

  return { data: currentData, error: currentError, loading: enabled && (loading || awaitingCurrentPath), refresh, refreshing };
}
