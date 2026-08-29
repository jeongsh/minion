import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { OBJECTIVE_ICON_PATHS } from '@/constants/objective-icons';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import {
  fetchMobileApi,
  mutateMobileApi,
  type MobileCommunityNotificationsDto,
  type MobileLiveMatchActivity,
  type MobileMatchActivityDto,
  type MobileNotificationPreferences,
} from '@/lib/api-client';
import { subscribeToForegroundPushNotifications, subscribeToPushNotificationResponses } from '@/lib/push-notifications';
import { useAuth } from '@/providers/auth-provider';
import type { MatchEventToast } from '@/providers/minion-shell-provider';

const ACTIVITY_POLL_MS = 30_000;
const LIVE_EVENT_POLL_MS = 10_000;
const MEMBER_NOTIFICATION_POLL_MS = 60_000;
const GUEST_NOTIFICATION_POLL_MS = 5 * 60_000;
const LEGACY_NOTIFICATION_STORAGE_KEY = 'minion-notifications-v1';
const NOTIFICATION_STORAGE_KEY_PREFIX = 'minion-notifications-v2';
const MAX_NOTIFICATIONS = 100;

const DEFAULT_PREFERENCES: MobileNotificationPreferences = {
  inAppEnabled: true,
  communityEnabled: true,
  matchStartEnabled: true,
  matchEventsEnabled: false,
  ratingOpenEnabled: true,
  teamContentEnabled: true,
};

const DRAGON_PRESENTATION: Record<string, { icon: string; label: string }> = {
  chemtech: { icon: OBJECTIVE_ICON_PATHS.chemtechDragon, label: '화학공학 드래곤' },
  cloud: { icon: OBJECTIVE_ICON_PATHS.cloudDragon, label: '바람 드래곤' },
  elder: { icon: OBJECTIVE_ICON_PATHS.elder, label: '장로 드래곤' },
  hextech: { icon: OBJECTIVE_ICON_PATHS.hextechDragon, label: '마법공학 드래곤' },
  infernal: { icon: OBJECTIVE_ICON_PATHS.infernalDragon, label: '화염 드래곤' },
  mountain: { icon: OBJECTIVE_ICON_PATHS.mountainDragon, label: '대지 드래곤' },
  ocean: { icon: OBJECTIVE_ICON_PATHS.oceanDragon, label: '바다 드래곤' },
};

export type InAppNotificationKind = 'match_live' | 'match_event' | 'rating_open' | 'team_video' | 'team_social' | 'player_live' | 'post_activity';
type MatchEventKind = 'kill' | 'tower' | 'baron' | 'inhibitor' | 'dragon' | 'end' | 'start' | 'rating';

export type InAppNotification = {
  createdAt: string;
  description?: string;
  href?: string;
  id: string;
  imageUrl?: string | null;
  kind: InAppNotificationKind;
  matchEvent?: MatchEventToast;
  matchEventKind?: MatchEventKind;
  readAt: string | null;
  title: string;
};

type LiveMatchEvent = {
  dragonType: string | null;
  id: string;
  killerChampionId: string | null;
  killerSummonerName: string | null;
  teamId: string | null;
  type: Exclude<MatchEventKind, 'start' | 'rating'>;
  victimChampionId: string | null;
  victimSummonerName: string | null;
};

type LiveMatchResponse = { events?: LiveMatchEvent[]; status: string };

type NotificationContextValue = {
  clearNotifications: () => void;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  notifications: InAppNotification[];
  removeNotification: (id: string) => void;
  unreadCount: number;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function parseNotifications(raw: string | null): InAppNotification[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is InAppNotification => Boolean(
      item && typeof item === 'object'
      && typeof (item as InAppNotification).id === 'string'
      && typeof (item as InAppNotification).title === 'string'
      && typeof (item as InAppNotification).createdAt === 'string',
    )).slice(0, MAX_NOTIFICATIONS);
  } catch {
    return [];
  }
}

function championImage(championId: string | null) {
  if (!championId) return null;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${encodeURIComponent(championId)}_0.jpg`;
}

function liveEventPresentation(event: LiveMatchEvent, match: MobileLiveMatchActivity): MatchEventToast {
  const matchup = `${match.teamA.shortName} vs ${match.teamB.shortName}`;
  if (event.type === 'kill') {
    return {
      badge: 'LIVE',
      kind: event.type,
      leftImageSrc: championImage(event.killerChampionId) ?? undefined,
      leftLabel: event.killerSummonerName ?? '선수',
      matchup,
      rightImageSrc: championImage(event.victimChampionId) ?? undefined,
      rightLabel: event.victimSummonerName ?? '상대 선수',
    };
  }

  const teamLabel = event.teamId === match.teamA.id
    ? match.teamA.shortName
    : event.teamId === match.teamB.id
      ? match.teamB.shortName
      : '경기';
  const dragon = event.dragonType ? DRAGON_PRESENTATION[event.dragonType.toLowerCase()] : undefined;
  const objectiveLabel = event.type === 'baron'
    ? '바론'
    : event.type === 'dragon'
      ? dragon?.label ?? '드래곤'
      : event.type === 'tower'
        ? '포탑'
        : event.type === 'inhibitor'
          ? '억제기'
          : '종료';
  const objectiveImage = event.type === 'baron'
    ? OBJECTIVE_ICON_PATHS.baron
    : event.type === 'dragon'
      ? dragon?.icon ?? OBJECTIVE_ICON_PATHS.dragon
      : event.type === 'tower' || event.type === 'inhibitor'
        ? OBJECTIVE_ICON_PATHS.tower
        : undefined;
  return {
    badge: 'LIVE',
    kind: event.type,
    leftLabel: event.type === 'end' ? '세트' : teamLabel,
    matchup,
    rightImageSrc: objectiveImage,
    rightLabel: objectiveLabel,
  };
}

function notificationAllowed(type: unknown, preferences: MobileNotificationPreferences) {
  if (!preferences.inAppEnabled) return false;
  return type === 'post_activity' ? preferences.communityEnabled : true;
}

export function InAppNotificationsProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const { session } = useAuth();
  const { showMatchEventToast, showToast } = useMinionTheme();
  const [hydrated, setHydrated] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const [communityNotifications, setCommunityNotifications] = useState<InAppNotification[]>([]);
  const [communityNotificationScope, setCommunityNotificationScope] = useState<string | null>(null);
  const [activity, setActivity] = useState<MobileMatchActivityDto | null>(null);
  const notificationsRef = useRef<InAppNotification[]>([]);
  const preferencesRef = useRef(DEFAULT_PREFERENCES);
  const initialized = useRef(false);
  const previousLiveIds = useRef(new Set<string>());
  const previousRatingIds = useRef(new Set<string>());
  const eventIdsByMatch = useRef(new Map<string, Set<string>>());
  const persistenceQueue = useRef(Promise.resolve());
  const handledPushResponseIds = useRef(new Set<string>());
  const userId = session?.user.id ?? null;
  const identityScope = userId ? `user:${userId}` : 'guest';
  const notificationStorageKey = userId ? `${NOTIFICATION_STORAGE_KEY_PREFIX}:${userId}` : null;

  useEffect(() => {
    if (!userId) return;
    return subscribeToPushNotificationResponses((response) => {
      if (handledPushResponseIds.current.has(response.id)) return;
      const targetUserId = typeof response.data.userId === 'string' ? response.data.userId : null;
      const url = typeof response.data.url === 'string' ? response.data.url : null;
      if (targetUserId !== userId || !url) return;
      handledPushResponseIds.current.add(response.id);
      router.push(url as never);
    });
  }, [router, userId]);

  const replaceNotifications = useCallback((next: InAppNotification[]) => {
    const limited = next.slice(0, MAX_NOTIFICATIONS);
    notificationsRef.current = limited;
    setNotifications(limited);
    if (!notificationStorageKey) return;
    persistenceQueue.current = persistenceQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(notificationStorageKey, JSON.stringify(limited)))
      .catch(() => undefined);
  }, [notificationStorageKey]);

  const presentNotification = useCallback((notification: InAppNotification) => {
    if (notification.matchEvent) {
      showMatchEventToast(notification.matchEvent, notification.href ? () => router.push(notification.href as never) : undefined);
      return;
    }
    const message = [notification.title, notification.description].filter(Boolean).join(' — ');
    if (message) showToast(message, 'info');
  }, [router, showMatchEventToast, showToast]);

  const publishNotification = useCallback((notification: InAppNotification, present = true) => {
    const duplicateIndex = notificationsRef.current.findIndex((item) => (
      item.id === notification.id
      || (notification.kind === 'rating_open' && item.kind === notification.kind && item.href === notification.href)
    ));
    if (duplicateIndex >= 0) {
      const existing = notificationsRef.current[duplicateIndex];
      if (notification.matchEvent && !existing.matchEvent) {
        const next = [...notificationsRef.current];
        next[duplicateIndex] = { ...existing, ...notification, readAt: existing.readAt };
        replaceNotifications(next);
        if (present) presentNotification(notification);
      }
      return;
    }
    replaceNotifications([notification, ...notificationsRef.current]);
    if (present) presentNotification(notification);
  }, [presentNotification, replaceNotifications]);

  useEffect(() => {
    let active = true;
    notificationsRef.current = [];
    queueMicrotask(() => {
      if (!active) return;
      setNotifications([]);
      setHydratedStorageKey(notificationStorageKey);
      setHydrated(false);
    });
    void AsyncStorage.removeItem(LEGACY_NOTIFICATION_STORAGE_KEY).catch(() => undefined);

    if (!notificationStorageKey) {
      queueMicrotask(() => { if (active) setHydrated(true); });
      return () => { active = false; };
    }

    void AsyncStorage.getItem(notificationStorageKey).then((raw) => {
      if (!active) return;
      const stored = parseNotifications(raw);
      notificationsRef.current = stored;
      setNotifications(stored);
    }).finally(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, [notificationStorageKey]);

  const loadCommunityNotifications = useCallback(async () => {
    const data = await fetchMobileApi<MobileCommunityNotificationsDto>('/api/mobile/v1/notifications');
    setCommunityNotifications(data.notifications as InAppNotification[]);
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setCommunityNotificationScope(identityScope);
      setCommunityNotifications([]);
    });
    const load = async () => {
      try {
        const data = await fetchMobileApi<MobileCommunityNotificationsDto>('/api/mobile/v1/notifications');
        if (active) setCommunityNotifications(data.notifications as InAppNotification[]);
      } catch {
        // 알림 조회 실패가 앱 탐색을 막지 않게 하고 다음 폴링에서 다시 시도한다.
      }
    };
    void load();
    const pollMs = userId ? MEMBER_NOTIFICATION_POLL_MS : GUEST_NOTIFICATION_POLL_MS;
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void load();
    }, pollMs);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      active = false;
      clearInterval(interval);
      appState.remove();
    };
  }, [identityScope, userId]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    return subscribeToForegroundPushNotifications((push) => {
      const targetUserId = typeof push.data.userId === 'string' ? push.data.userId : null;
      if (targetUserId !== userId) return;
      const type = push.data.type;
      if (!notificationAllowed(type, preferencesRef.current)) return;
      const kind: InAppNotificationKind = type === 'match_start'
        ? 'match_live'
        : type === 'rating_open'
          ? 'rating_open'
          : type === 'match_event'
            ? 'match_event'
            : type === 'team_video'
              ? 'team_video'
              : type === 'team_social'
                ? 'team_social'
                : 'post_activity';
      const matchId = typeof push.data.matchId === 'string' ? push.data.matchId : null;
      const eventId = typeof push.data.eventId === 'string' ? push.data.eventId : null;
      const remoteNotificationId = typeof push.data.notificationId === 'string' ? push.data.notificationId : null;
      if (kind === 'team_video' || kind === 'team_social') {
        presentNotification({
          createdAt: push.createdAt,
          description: push.body ?? undefined,
          href: typeof push.data.url === 'string' ? push.data.url : undefined,
          id: remoteNotificationId ? `content:${remoteNotificationId}` : `push:${push.id}`,
          kind,
          readAt: null,
          title: push.title ?? '새 팀 소식',
        });
        void loadCommunityNotifications();
        return;
      }
      const notificationId = type === 'match_start' && matchId
        ? `match-live:${matchId}`
        : type === 'match_event' && eventId
          ? `match-event:${eventId}`
          : `push:${push.id}`;
      publishNotification({
        createdAt: push.createdAt,
        description: push.body ?? undefined,
        href: typeof push.data.url === 'string' ? push.data.url : undefined,
        id: notificationId,
        kind,
        matchEventKind: type === 'match_start' ? 'start' : type === 'rating_open' ? 'rating' : undefined,
        readAt: null,
        title: push.title ?? '새 알림',
      }, type !== 'match_start' && type !== 'match_event' && type !== 'rating_open');
    });
  }, [hydrated, loadCommunityNotifications, presentNotification, publishNotification, userId]);

  useEffect(() => {
    initialized.current = false;
    previousLiveIds.current = new Set();
    previousRatingIds.current = new Set();
    eventIdsByMatch.current = new Map();
    queueMicrotask(() => setActivity(null));
    preferencesRef.current = DEFAULT_PREFERENCES;
    if (!hydrated || !userId) return;

    let active = true;
    const loadActivity = async () => {
      try {
        const next = await fetchMobileApi<MobileMatchActivityDto>('/api/mobile/v1/me/match-activity');
        if (!active) return;
        const preferences = next.notificationPreferences;
        preferencesRef.current = preferences;
        const matchAlertTeamIds = new Set(next.teamNotificationSettings.filter((setting) => setting.matchAlertsEnabled).map((setting) => setting.teamId));
        const matchLiveMatches = next.liveMatches.filter((match) => matchAlertTeamIds.has(match.teamA.id) || matchAlertTeamIds.has(match.teamB.id));
        const matchRatings = next.ratings.filter((rating) => matchAlertTeamIds.has(rating.teamA.id) || matchAlertTeamIds.has(rating.teamB.id));

        if (initialized.current && preferences.inAppEnabled) {
          for (const match of matchLiveMatches) {
            if (previousLiveIds.current.has(match.id)) continue;
            publishNotification({
              createdAt: new Date().toISOString(),
              description: '팔로우한 팀의 경기가 시작됐어요.',
              href: match.href,
              id: `match-live:${match.id}`,
              kind: 'match_live',
              matchEvent: {
                badge: 'LIVE',
                kind: 'start',
                leftLabel: '경기',
                matchup: `${match.teamA.shortName} vs ${match.teamB.shortName}`,
                rightLabel: '시작',
              },
              matchEventKind: 'start',
              readAt: null,
              title: `${match.teamA.shortName} vs ${match.teamB.shortName}`,
            });
          }
          for (const rating of matchRatings) {
            if (previousRatingIds.current.has(rating.id)) continue;
            publishNotification({
              createdAt: new Date().toISOString(),
              description: `${rating.teamA.shortName} vs ${rating.teamB.shortName}`,
              href: rating.href,
              id: `rating-open:${rating.id}`,
              kind: 'rating_open',
              matchEvent: {
                badge: '평가',
                kind: 'rating',
                leftLabel: `${rating.setNumber}세트`,
                matchup: `${rating.teamA.shortName} vs ${rating.teamB.shortName}`,
                rightLabel: '평가하기',
              },
              matchEventKind: 'rating',
              readAt: null,
              title: `${rating.setNumber}세트 평가가 열렸어요`,
            });
          }
        }

        previousLiveIds.current = new Set(matchLiveMatches.map((match) => match.id));
        previousRatingIds.current = new Set(matchRatings.map((rating) => rating.id));
        initialized.current = true;
        setActivity(next);
      } catch {
        // 전역 보조 기능이므로 일시적인 네트워크 오류가 화면 탐색을 막지 않게 한다.
      }
    };

    void loadActivity();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void loadActivity();
    }, ACTIVITY_POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadActivity();
    });
    return () => {
      active = false;
      clearInterval(interval);
      appState.remove();
    };
  }, [hydrated, publishNotification, userId]);

  useEffect(() => {
    if (!hydrated || !userId || !activity?.notificationPreferences.inAppEnabled || activity.liveMatches.length === 0) return;
    const liveMatchAlertTeamIds = new Set(activity.teamNotificationSettings.filter((setting) => setting.liveMatchAlertsEnabled).map((setting) => setting.teamId));
    const liveMatches = activity.liveMatches.filter((match) => liveMatchAlertTeamIds.has(match.teamA.id) || liveMatchAlertTeamIds.has(match.teamB.id));
    if (liveMatches.length === 0) return;
    let active = true;
    const pollEvents = async () => {
      await Promise.all(liveMatches.map(async (match: MobileLiveMatchActivity) => {
        try {
          const data = await fetchMobileApi<LiveMatchResponse>(`/api/mobile/v1/matches/${encodeURIComponent(match.id)}/live`);
          if (!active || !Array.isArray(data.events)) return;
          const known = eventIdsByMatch.current.get(match.id);
          const currentIds = new Set(data.events.map((event) => event.id));
          if (!known) {
            eventIdsByMatch.current.set(match.id, currentIds);
            return;
          }
          const newEvents = data.events.filter((event) => !known.has(event.id)).slice(-2);
          eventIdsByMatch.current.set(match.id, currentIds);
          for (const event of newEvents) {
            const matchEvent = liveEventPresentation(event, match);
            publishNotification({
              createdAt: new Date().toISOString(),
              href: match.href,
              id: `match-event:${event.id}`,
              imageUrl: matchEvent.rightImageSrc ?? matchEvent.leftImageSrc,
              kind: 'match_event',
              matchEvent,
              matchEventKind: event.type,
              readAt: null,
              title: `${match.teamA.shortName} vs ${match.teamB.shortName}`,
            });
          }
        } catch {
          // 라이브 피드가 잠시 끊겨도 다음 폴링에서 이어 받는다.
        }
      }));
    };
    void pollEvents();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void pollEvents();
    }, LIVE_EVENT_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activity, hydrated, publishNotification, userId]);

  const markNotificationRead = useCallback((id: string) => {
    if (id.startsWith('community:') || id.startsWith('content:')) {
      const readAt = new Date().toISOString();
      setCommunityNotifications((current) => current.map((item) => item.id === id && !item.readAt ? { ...item, readAt } : item));
      void mutateMobileApi('/api/mobile/v1/notifications', 'PATCH', { id }).catch(() => loadCommunityNotifications());
      return;
    }
    const readAt = new Date().toISOString();
    replaceNotifications(notificationsRef.current.map((item) => item.id === id && !item.readAt ? { ...item, readAt } : item));
  }, [loadCommunityNotifications, replaceNotifications]);

  const markAllNotificationsRead = useCallback(() => {
    setCommunityNotifications((current) => current.map((item) => item.readAt ? item : { ...item, readAt: new Date().toISOString() }));
    void mutateMobileApi('/api/mobile/v1/notifications', 'PATCH', { all: true }).catch(() => loadCommunityNotifications());
    const readAt = new Date().toISOString();
    replaceNotifications(notificationsRef.current.map((item) => item.readAt ? item : { ...item, readAt }));
  }, [loadCommunityNotifications, replaceNotifications]);

  const removeNotification = useCallback((id: string) => {
    if (id.startsWith('community:') || id.startsWith('content:')) {
      setCommunityNotifications((current) => current.filter((item) => item.id !== id));
      void mutateMobileApi(`/api/mobile/v1/notifications?id=${encodeURIComponent(id)}`, 'DELETE').catch(() => loadCommunityNotifications());
      return;
    }
    replaceNotifications(notificationsRef.current.filter((item) => item.id !== id));
  }, [loadCommunityNotifications, replaceNotifications]);

  const clearNotifications = useCallback(() => {
    setCommunityNotifications([]);
    void mutateMobileApi('/api/mobile/v1/notifications?all=true', 'DELETE').catch(() => loadCommunityNotifications());
    replaceNotifications([]);
  }, [loadCommunityNotifications, replaceNotifications]);
  const displayNotifications = useMemo(
    () => [
      ...(communityNotificationScope === identityScope ? communityNotifications : []),
      ...(hydratedStorageKey === notificationStorageKey ? notifications : []),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, MAX_NOTIFICATIONS),
    [communityNotificationScope, communityNotifications, hydratedStorageKey, identityScope, notificationStorageKey, notifications],
  );
  const unreadCount = displayNotifications.filter((notification) => !notification.readAt).length;
  const value = useMemo<NotificationContextValue>(() => ({
    clearNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notifications: displayNotifications,
    removeNotification,
    unreadCount,
  }), [clearNotifications, displayNotifications, markAllNotificationsRead, markNotificationRead, removeNotification, unreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useInAppNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useInAppNotifications must be used inside InAppNotificationsProvider');
  return value;
}
