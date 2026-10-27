import AsyncStorage from '@react-native-async-storage/async-storage';

type Entry = { xml: string; savedAt: number };
const STORAGE_KEY = 'minion-team-svg-cache-v1';
const MAX_AGE_MS = 24 * 60 * 60_000;
const MAX_ENTRIES = 64;
// Bound the whole serialized cache, including embedded raster images in SVGs.
const MAX_CHARACTERS = 750_000;
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<string>>();
let hydration: Promise<void> | undefined;
let storageWrites = Promise.resolve();

export function readTeamLogoXml(uri: string): string | null {
  const entry = entries.get(uri);
  if (!entry) return null;
  if (Date.now() - entry.savedAt >= MAX_AGE_MS) {
    entries.delete(uri);
    return null;
  }
  return entry.xml;
}

function trimCache() {
  for (const uri of entries.keys()) readTeamLogoXml(uri);
  while (entries.size > MAX_ENTRIES || JSON.stringify([...entries]).length > MAX_CHARACTERS) {
    entries.delete(entries.keys().next().value!);
  }
}

function hydrate() {
  return hydration ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const stored: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(stored)) return;
      for (const item of stored) {
        if (!Array.isArray(item) || item.length !== 2) continue;
        const [uri, entry] = item;
        if (typeof uri !== 'string' || !entry || typeof entry.xml !== 'string' || !Number.isFinite(entry.savedAt)) continue;
        if (!entries.has(uri)) entries.set(uri, entry);
      }
      trimCache();
    } catch {
      // A missing/corrupt or unavailable device cache falls back to the network.
    }
  })();
}

export function loadTeamLogoXml(uri: string): Promise<string> {
  const cached = readTeamLogoXml(uri);
  if (cached !== null) return Promise.resolve(cached);
  const existing = pending.get(uri);
  if (existing) return existing;
  const request = (async () => {
    await hydrate();
    const stored = readTeamLogoXml(uri);
    if (stored !== null) return stored;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(uri, { signal: controller.signal });
      if (!response.ok) throw new Error(`Team logo request failed: HTTP ${response.status}`);
      const xml = await response.text();
      if (!/<svg[\s>]/i.test(xml)) throw new Error('Team logo response is not SVG');
      entries.delete(uri);
      entries.set(uri, { xml, savedAt: Date.now() });
      trimCache();
      storageWrites = storageWrites.then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...entries]))).catch(() => {
        // Keep the in-memory image usable if device storage is unavailable/full.
      });
      return xml;
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => pending.delete(uri));
  pending.set(uri, request);
  return request;
}
