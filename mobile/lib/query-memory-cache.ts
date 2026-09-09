type Entry = { data: unknown; savedAt: number };

// Bound both memory use and how long an offline snapshot can survive.
export function createQueryMemoryCache(maxEntries = 60, maxAgeMs = 10 * 60_000) {
  const entries = new Map<string, Entry>();
  let revision = 0;
  return {
    get revision() { return revision; },
    read<T>(key: string): { data: T; savedAt: number } | null {
      const entry = entries.get(key);
      if (!entry) return null;
      if (Date.now() - entry.savedAt > maxAgeMs) {
        entries.delete(key);
        return null;
      }
      return entry as { data: T; savedAt: number };
    },
    write(key: string, data: unknown, savedAt = Date.now()) {
      entries.delete(key);
      entries.set(key, { data, savedAt });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
    },
    invalidate(prefix = '') {
      revision += 1;
      for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
    },
  };
}
