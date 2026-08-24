import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import type { MobileApiError, MobileApiSuccess } from '../../packages/contracts/src/mobile-v1';
import { getInstallationId } from '@/lib/secure-storage';
import { supabase } from '@/lib/supabase';

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
  const [{ data: { session } }, installationId] = await Promise.all([supabase.auth.getSession(), getInstallationId()]);
  const response = await fetch(`${mobileApiOrigin}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Minion-Installation-Id': installationId,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    signal,
  });
  const body = await response.json() as MobileApiSuccess<T> | MobileApiError;
  if (!response.ok || 'error' in body) throw new Error('error' in body ? body.error.message : `HTTP ${response.status}`);
  return body.data;
}

export async function mutateMobileApi<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', payload?: unknown): Promise<T> {
  const [{ data: { session } }, installationId] = await Promise.all([supabase.auth.getSession(), getInstallationId()]);
  const response = await fetch(`${mobileApiOrigin}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Minion-Installation-Id': installationId,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
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
  MobileBracketData,
  MobileBracketMatch,
  MobileBracketStagePill,
  MobileChampionRef,
  MobileFanRatingComment,
  MobileFanRatingPanel,
  MobileFanRatingPlayer,
  MobileHomeDto,
  MobileBootstrapDto,
  MobileMeDto,
  MobileNotificationPreferences,
  MobileMatchDetailDto,
  MobileMatchHeader,
  MobileMatchPreview,
  MobileMatchSetSummary,
  MobileMatchSummary,
  MobileNewsDto,
  MobileNewsItem,
  MobileObjectiveCounts,
  MobilePlayerLoadout,
  MobilePlayersDto,
  MobilePlayerDetailDto,
  MobilePlayerSummary,
  MobilePomRow,
  MobilePredictionMatch,
  MobilePredictionsDto,
  MobileScheduleDto,
  MobileSearchDto,
  MobileSearchResult,
  MobileSetDetail,
  MobileSetDraftSide,
  MobileSetPlayerStat,
  MobileStandingRow,
  MobileStandingsGroup,
  MobileTeamDetailDto,
  MobileTeamSummary,
  MobileTeamsDto,
  MobileTimelineEvent,
  MobileTimelineFrame,
  MobileTournamentDetailDto,
  MobileTournamentSegmentNavItem,
  MobileTournamentsDto,
  MobileTournamentSummary,
  MobileVideoItem,
} from '../../packages/contracts/src/mobile-v1';
