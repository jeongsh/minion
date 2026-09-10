import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { mobileApiAuthForRequest, type MobileApiAuthMode, type MobileApiError, type MobileApiRouteDefinition, type MobileApiSuccess } from '../../packages/contracts/src/mobile-v1';
import { getInstallationId } from '@/lib/secure-storage';
import { supabase } from '@/lib/supabase';
import { createQueryMemoryCache } from '@/lib/query-memory-cache';

const CACHE_PREFIX = 'minion-api-v1:';
const LOGIN_REQUIRED_MESSAGE = '로그인이 필요합니다.';
const cacheInvalidationListeners = new Set<(pathPrefix: string) => void>();
const memoryCache = createQueryMemoryCache();
type QueryRequest = {
  promise: Promise<unknown>;
  fresh: boolean;
  controller: AbortController;
  subscribers: Set<AbortSignal>;
  keepAlive: boolean;
  settled: boolean;
};
const queryRequests = new Map<string, QueryRequest>();
const storageInvalidations = new Set<string>();
let sessionRequest: ReturnType<typeof supabase.auth.getSession> | undefined;
let sessionRevision = 0;

export function resetApiSessionRead() {
  sessionRevision += 1;
  sessionRequest = undefined;
}

function readRequestSession() {
  if (sessionRequest) return sessionRequest;
  const request = supabase.auth.getSession().finally(() => {
    if (sessionRequest === request) sessionRequest = undefined;
  });
  sessionRequest = request;
  return request;
}

export class MobileApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function discardApiMemoryCache(key: string) {
  memoryCache.invalidate(key);
}

export const readApiMemoryCache = memoryCache.read;

export function clearApiMemoryCache() {
  memoryCache.invalidate();
  queryRequests.clear();
  cacheInvalidationListeners.forEach((listener) => listener(''));
}

export type ApiCacheMode = boolean | 'memory';

type QueryRequestOptions = { staleTimeMs?: number; signal?: AbortSignal; cancelOnUnused?: boolean };

function subscribeRequest<T>(request: QueryRequest, { signal, cancelOnUnused }: QueryRequestOptions) {
  if (!signal || !cancelOnUnused) request.keepAlive = true;
  if (signal) {
    request.subscribers.add(signal);
    const release = () => {
      signal.removeEventListener('abort', release);
      request.subscribers.delete(signal);
      if (!request.settled && !request.keepAlive && request.subscribers.size === 0) request.controller.abort();
    };
    signal.addEventListener('abort', release, { once: true });
    void request.promise.then(release, release);
    if (signal.aborted) release();
  }
  return request.promise as Promise<T>;
}

export function fetchMobileQuery<T>(path: string, key: string, cache: ApiCacheMode, fresh: boolean, options: QueryRequestOptions = {}): Promise<T> {
  const revision = memoryCache.revision;
  const requestKey = JSON.stringify([key, cache, revision]);
  const existing = queryRequests.get(requestKey);
  if (existing && !existing.controller.signal.aborted && (!fresh || existing.fresh)) return subscribeRequest<T>(existing, options);
  if (cache && !fresh && (options.staleTimeMs ?? 0) > 0 && authForRequest('GET', path) === 'public') {
    const snapshot = memoryCache.read<T>(key);
    if (snapshot && Date.now() - snapshot.savedAt < options.staleTimeMs!) return Promise.resolve(snapshot.data);
  }
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('연결이 지연되고 있습니다. 네트워크를 확인한 뒤 다시 시도해주세요.'));
      controller.abort();
    }, 20_000);
    controller.signal.addEventListener('abort', () => {
      const error = new Error('Request cancelled');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });
  const entry: QueryRequest = { promise: Promise.resolve(), fresh, controller, subscribers: new Set(), keepAlive: false, settled: false };
  const request = Promise.race([fetchMobileApi<T>(path, controller.signal, { fresh }), timeout]).then((data) => {
    if (cache && memoryCache.revision === revision && queryRequests.get(requestKey)?.promise === request) {
      memoryCache.write(key, data);
      if (cache === true) void writeApiCache(key, data);
    }
    return data;
  }).finally(() => {
    entry.settled = true;
    clearTimeout(timeoutId);
    if (queryRequests.get(requestKey)?.promise === request) queryRequests.delete(requestKey);
  });
  entry.promise = request;
  queryRequests.set(requestKey, entry);
  return subscribeRequest<T>(entry, options);
}

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

async function accessTokenFor(auth: MobileApiAuthMode) {
  if (auth === 'public') return null;

  try {
    let revision: number;
    let result: Awaited<ReturnType<typeof readRequestSession>>;
    do {
      revision = sessionRevision;
      result = await readRequestSession();
    } while (revision !== sessionRevision);
    const { data, error } = result;
    if (error) throw error;
    const accessToken = data.session?.access_token ?? null;
    if (auth === 'required' && !accessToken) throw new Error(LOGIN_REQUIRED_MESSAGE);
    return accessToken;
  } catch (error) {
    if (auth === 'optional') return null;
    if (error instanceof Error && error.message === LOGIN_REQUIRED_MESSAGE) throw error;
    throw new Error('로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
}

function authForRequest(method: MobileApiRouteDefinition['method'], path: string) {
  const auth = mobileApiAuthForRequest(method, path);
  if (!auth) throw new Error(`등록되지 않은 모바일 API 요청입니다: ${method} ${path}`);
  return auth;
}

async function readMobileResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let body: MobileApiSuccess<T> | MobileApiError;
  try {
    body = JSON.parse(raw) as MobileApiSuccess<T> | MobileApiError;
  } catch {
    throw new Error(`서버 응답을 처리하지 못했습니다. (HTTP ${response.status})`);
  }
  if (!response.ok || 'error' in body) throw new MobileApiRequestError('error' in body ? body.error.message : `HTTP ${response.status}`, response.status);
  return body.data;
}

async function requestHeaders(auth: MobileApiAuthMode, json = false) {
  const [accessToken, installationId] = await Promise.all([accessTokenFor(auth), getInstallationId()]);
  return {
    Accept: 'application/json',
    'X-Minion-Installation-Id': installationId,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

function freshPath(path: string) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}_minion_t=${Date.now()}`;
}

export async function fetchMobileApi<T>(path: string, signal?: AbortSignal, options: { fresh?: boolean } = {}): Promise<T> {
  const headers = await requestHeaders(authForRequest('GET', path));
  const response = await fetch(`${mobileApiOrigin}${options.fresh ? freshPath(path) : path}`, {
    cache: options.fresh ? 'no-store' : 'default',
    headers: options.fresh ? { ...headers, 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : headers,
    signal,
  });
  return readMobileResponse<T>(response);
}

export async function mutateMobileApi<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', payload?: unknown): Promise<T> {
  const response = await fetch(`${mobileApiOrigin}${path}`, {
    method,
    headers: await requestHeaders(authForRequest(method, path), true),
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  return readMobileResponse<T>(response);
}

export async function uploadMobileApi<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${mobileApiOrigin}${path}`, {
    method: 'POST',
    headers: await requestHeaders(authForRequest('POST', path)),
    body: formData,
  });
  return readMobileResponse<T>(response);
}

export async function readApiCache<T>(key: string) {
  const memory = memoryCache.read<T>(key);
  if (memory) return memory;
  const revision = memoryCache.revision;
  try {
    if ([...storageInvalidations].some((prefix) => key.startsWith(prefix))) return null;
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw || revision !== memoryCache.revision) return null;
    const entry = JSON.parse(raw) as { data: T; savedAt: number };
    const current = memoryCache.read<T>(key);
    if (current) return current;
    if (!entry || !Number.isFinite(entry.savedAt) || !('data' in entry)) return null;
    memoryCache.write(key, entry.data, entry.savedAt);
    return memoryCache.read<T>(key);
  } catch {
    return null;
  }
}

export async function writeApiCache<T>(key: string, data: T) {
  memoryCache.write(key, data);
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // The network result remains usable when storage is unavailable or full.
  }
}

export async function invalidateApiCache(pathPrefix: string) {
  memoryCache.invalidate(pathPrefix);
  storageInvalidations.add(pathPrefix);
  cacheInvalidationListeners.forEach((listener) => listener(pathPrefix));
  try {
    const cacheKeyPrefix = `${CACHE_PREFIX}${pathPrefix}`;
    const keys = await AsyncStorage.getAllKeys();
    const targets = keys.filter((key) => key.startsWith(cacheKeyPrefix));
    if (targets.length > 0) await AsyncStorage.multiRemove(targets);
  } catch {
    // 캐시 정리 실패가 이미 완료된 게시글 등록을 실패로 바꾸면 안 된다.
  } finally {
    storageInvalidations.delete(pathPrefix);
  }
}

export function subscribeApiCacheInvalidation(listener: (pathPrefix: string) => void) {
  cacheInvalidationListeners.add(listener);
  return () => {
    cacheInvalidationListeners.delete(listener);
  };
}

export type {
  MobileBracketData,
  MobileBracketMatch,
  MobileBracketStagePill,
  MobileChampionRef,
  MobileChampionBuild,
  MobileChampionDetailDto,
  MobileChampionDirectoryItem,
  MobileChampionGame,
  MobileChampionItem,
  MobileChampionItemSequence,
  MobileChampionMatchup,
  MobileChampionPosition,
  MobileChampionPro,
  MobileChampionRuneColumn,
  MobileChampionRuneOption,
  MobileChampionScope,
  MobileChampionSummary,
  MobileChampionsDto,
  MobileCommunityActionDto,
  MobileCommunityAuthor,
  MobileCommunityComment,
  MobileCommunityCommentMutationDto,
  MobileCommunityNotification,
  MobileCommunityNotificationsDto,
  MobileCommunityPollDto,
  MobileCommunityPostDetailDto,
  MobileCommunityPostMutationDto,
  MobileCommunityPostSummary,
  MobileCommunityPostsDto,
  MobileCommunityReactionDto,
  MobileCommunityUploadDto,
  MobileMiniconItem,
  MobileMiniconCatalogDto,
  MobileMiniconPack,
  MobileMiniconSettingsDto,
  MobileMiniconApplication,
  MobileMiniconApplicationsDto,
  MobileMiniconApplicationMutationDto,
  MobileMiniconUploadDto,
  MobileCommunityUserActivityComment,
  MobileCommunityUserActivityPost,
  MobileCommunityUserDto,
  MobileFanRatingComment,
  MobileFanRatingMutationDto,
  MobileFanRatingPanel,
  MobileFanRatingPlayer,
  MobileFanCalendarSubmissionDto,
  MobileHomeDto,
  MobileBootstrapDto,
  MobileMeDto,
  MobileLiveMatchActivity,
  MobileMatchActivityDto,
  MobileNotificationPreferences,
  MobileMatchDetailDto,
  MobileMatchTabDto,
  MobileMatchHeader,
  MobileMatchPreview,
  MobileMatchSetSummary,
  MobileMatchSummary,
  MobileNewsDto,
  MobileNewsItem,
  MobileObjectiveCounts,
  MobilePlayerLoadout,
  MobilePlayerChampionRow,
  MobilePlayerDetailAxis,
  MobilePlayerDirectoryItem,
  MobilePlayersDto,
  MobilePlayerDetailDto,
  MobilePlayerRecentMatch,
  MobilePlayerRecentSet,
  MobilePlayerReview,
  MobilePlayerSummary,
  MobilePomRow,
  MobilePredictionMatch,
  MobilePredictionMutationDto,
  MobilePredictionsDto,
  MobileRatingMatchActivity,
  MobileScheduleDto,
  MobileSearchDto,
  MobileSearchResult,
  MobileSetDetail,
  MobileSetDraftSide,
  MobileSetPlayerStat,
  MobileStandingRow,
  MobileStandingsGroup,
  MobileSupportBoardDto,
  MobileSupportBoardItem,
  MobileSupportInquiryDetailDto,
  MobileSupportInquiryMutationDto,
  MobileSupportStatus,
  MobileTeamDetailDto,
  MobileTeamFavoriteDto,
  MobileTeamFanDto,
  MobileTeamNotificationDto,
  MobileTeamNotificationSelection,
  MobileTeamNotificationSettings,
  MobileTeamSummary,
  MobileTeamsPageDto,
  MobileTeamsDto,
  MobileTimelineEvent,
  MobileTimelineFrame,
  MobileTournamentDetailDto,
  MobileTournamentSegmentNavItem,
  MobileTournamentsDto,
  MobileTournamentSummary,
  MobileVideoItem,
  TiptapDocument,
  TiptapNode,
} from '../../packages/contracts/src/mobile-v1';
