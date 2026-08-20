import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import type { MobileApiError, MobileApiSuccess } from '../../packages/contracts/src/mobile-v1';

const CACHE_PREFIX = 'minion-api-v1:';

function defaultApiOrigin() {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:3000` : 'http://127.0.0.1:3000';
}

export const mobileApiOrigin = (process.env.EXPO_PUBLIC_API_URL || defaultApiOrigin()).replace(/\/$/, '');

export function resolveApiAssetUrl(url?: string | null) {
  if (!url) return null;
  return url.startsWith('/') ? `${mobileApiOrigin}${url}` : url;
}

export async function fetchMobileApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${mobileApiOrigin}${path}`, { headers: { Accept: 'application/json' }, signal });
  const body = await response.json() as MobileApiSuccess<T> | MobileApiError;
  if (!response.ok || 'error' in body) throw new Error('error' in body ? body.error.message : `HTTP ${response.status}`);
  return body.data;
}

export async function readApiCache<T>(key: string) {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { data: T; savedAt: number };
  } catch {
    return null;
  }
}

export async function writeApiCache<T>(key: string, data: T) {
  await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ data, savedAt: Date.now() }));
}

export type {
  MobileHomeDto,
  MobileMatchDetailDto,
  MobileMatchSummary,
  MobileNewsDto,
  MobileNewsItem,
  MobilePlayersDto,
  MobilePlayerDetailDto,
  MobilePlayerSummary,
  MobileScheduleDto,
  MobileSearchDto,
  MobileSearchResult,
  MobileTeamDetailDto,
  MobileTeamSummary,
  MobileTeamsDto,
  MobileTournamentsDto,
  MobileTournamentSummary,
  MobileVideoItem,
} from '../../packages/contracts/src/mobile-v1';
