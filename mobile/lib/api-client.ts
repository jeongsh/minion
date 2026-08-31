import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { mobileApiAuthForRequest, type MobileApiAuthMode, type MobileApiError, type MobileApiRouteDefinition, type MobileApiSuccess } from '../../packages/contracts/src/mobile-v1';
import { getInstallationId } from '@/lib/secure-storage';
import { supabase } from '@/lib/supabase';

const CACHE_PREFIX = 'minion-api-v1:';
const LOGIN_REQUIRED_MESSAGE = '로그인이 필요합니다.';
const cacheInvalidationListeners = new Set<(pathPrefix: string) => void>();

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
    const { data, error } = await supabase.auth.getSession();
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
  if (!response.ok || 'error' in body) throw new Error('error' in body ? body.error.message : `HTTP ${response.status}`);
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

export async function fetchMobileApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${mobileApiOrigin}${path}`, {
    headers: await requestHeaders(authForRequest('GET', path)),
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

export async function invalidateApiCache(pathPrefix: string) {
  try {
    const cacheKeyPrefix = `${CACHE_PREFIX}${pathPrefix}`;
    const keys = await AsyncStorage.getAllKeys();
    const targets = keys.filter((key) => key.startsWith(cacheKeyPrefix));
    if (targets.length > 0) await AsyncStorage.multiRemove(targets);
  } catch {
    // 캐시 정리 실패가 이미 완료된 게시글 등록을 실패로 바꾸면 안 된다.
  } finally {
    cacheInvalidationListeners.forEach((listener) => listener(pathPrefix));
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
  MobileCommunityUserActivityComment,
  MobileCommunityUserActivityPost,
  MobileCommunityUserDto,
  MobileFanRatingComment,
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
