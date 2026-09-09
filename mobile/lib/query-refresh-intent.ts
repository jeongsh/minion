/** A manual refresh belongs to its current query, until one request finishes. */
export function createQueryRefreshIntent(initialKey: string) {
  let currentKey = initialKey;
  let version = 0;
  let pending: { key: string; version: number } | null = null;

  return {
    setKey(key: string) { currentKey = key; },
    request() {
      pending = { key: currentKey, version: ++version };
      return version;
    },
    start(key: string) {
      const intent = pending?.key === key ? pending : null;
      return {
        fresh: intent !== null,
        finish(cancelled = false) {
          // StrictMode and obsolete-search cleanup can cancel a request before
          // it finishes. Its replacement must still bypass the HTTP cache.
          if (!cancelled && intent !== null && pending === intent) pending = null;
        },
      };
    },
  };
}
