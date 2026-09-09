import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { type ApiCacheMode, discardApiMemoryCache, fetchMobileQuery, MobileApiRequestError, readApiCache, readApiMemoryCache, subscribeApiCacheInvalidation } from '@/lib/api-client';
import { createQueryRefreshIntent } from '@/lib/query-refresh-intent';

const NETWORK_ERROR_PATTERN = /failed to fetch|network request failed|load failed/i;

function userFacingError(error: unknown) {
  if (!(error instanceof Error) || !error.message) return '데이터를 불러오지 못했습니다.';
  if (NETWORK_ERROR_PATTERN.test(error.message)) return '네트워크 연결을 확인한 뒤 다시 시도해주세요.';
  return error.message;
}

export function useCachedQuery<T>(path: string, options: { enabled?: boolean; cache?: ApiCacheMode; cacheScope?: string; staleTimeMs?: number; cancelOnUnused?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const cache = options.cache ?? true;
  const staleTimeMs = options.staleTimeMs ?? 0;
  const cancelOnUnused = options.cancelOnUnused ?? false;
  const key = options.cacheScope === undefined ? path : `${path}#viewer=${options.cacheScope}`;
  const [data, setData] = useState<T | null>(() => cache ? readApiMemoryCache<T>(key)?.data ?? null : null);
  const [dataPath, setDataPath] = useState<string | null>(key);
  const [error, setError] = useState<string | null>(null);
  const [errorPath, setErrorPath] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [refreshIntent] = useState(() => createQueryRefreshIntent(key));

  useLayoutEffect(() => { refreshIntent.setKey(key); }, [key, refreshIntent]);
  const refresh = useCallback(() => setRequestVersion(refreshIntent.request()), [refreshIntent]);

  useEffect(() => subscribeApiCacheInvalidation((pathPrefix) => {
    if (path.startsWith(pathPrefix)) refresh();
  }), [path, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const refreshRequest = refreshIntent.start(key);
    let active = true;
    const controller = new AbortController();
    let networkFinished = false;
    setError(null);
    setErrorPath(null);
    setRefreshing(true);
    // Native storage must not delay the request or overwrite its newer result.
    const load = async () => {
      try {
        const next = await fetchMobileQuery<T>(path, key, cache, refreshRequest.fresh, { staleTimeMs, signal: controller.signal, cancelOnUnused });
        refreshRequest.finish();
        networkFinished = true;
        if (!active) return;
        setData(next);
        setDataPath(key);
      } catch (caught) {
        refreshRequest.finish(caught instanceof Error && caught.name === 'AbortError');
        networkFinished = true;
        if (active) {
          if (caught instanceof MobileApiRequestError && [401, 403, 404].includes(caught.status)) {
            discardApiMemoryCache(key);
            setData(null);
            setDataPath(key);
          }
          setError(userFacingError(caught));
          setErrorPath(key);
        }
      } finally {
        if (active) setRefreshing(false);
      }
    };
    void load();
    if (cache === true) void readApiCache<T>(key).then((cached) => {
      if (active && !networkFinished && cached) {
        setData(cached.data);
        setDataPath(key);
      }
    });
    return () => {
      active = false;
      controller.abort();
      // Detail requests finish for back navigation; obsolete search requests
      // stop once their last subscriber has left.
    };
  }, [cache, cancelOnUnused, enabled, key, path, refreshIntent, requestVersion, staleTimeMs]);

  const currentData = (dataPath === key ? data : null) ?? (cache ? readApiMemoryCache<T>(key)?.data ?? null : null);
  const currentError = errorPath === key ? error : null;
  const awaitingCurrentPath = enabled && currentData === null && currentError === null;

  return { data: currentData, error: currentError, loading: awaitingCurrentPath, refresh, refreshing: enabled && refreshing };
}
