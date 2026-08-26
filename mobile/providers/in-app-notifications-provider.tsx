import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { OBJECTIVE_ICON_PATHS } from '@/constants/objective-icons';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import {
  fetchMobileApi,
  type MobileLiveMatchActivity,
  type MobileMatchActivityDto,
  type MobileNotificationPreferences,
} from '@/lib/api-client';
import { subscribeToForegroundPushNotifications } from '@/lib/push-notifications';
import { useAuth } from '@/providers/auth-provider';
import type { MatchEventToast } from '@/providers/minion-shell-provider';

const ACTIVITY_POLL_MS = 30_000;
const LIVE_EVENT_POLL_MS = 10_000;
const NOTIFICATION_STORAGE_KEY = 'minion-notifications-v1';
const MAX_NOTIFICATIONS = 100;

const DEFAULT_PREFERENCES: MobileNotificationPreferences = {
  inAppEnabled: true,
  matchStartEnabled: true,
  matchEventsEnabled: false,
  ratingOpenEnabled: true,
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
  if (type === 'match_start') return preferences.matchStartEnabled;
  if (type === 'match_event') return preferences.matchEventsEnabled;
  if (type === 'rating_open') return preferences.ratingOpenEnabled;
  return true;
}

export function InAppNotificationsProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const { session } = useAuth();
  const { showMatchEventToast, showToast } = useMinionTheme();
  const [hydrated, setHydrated] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [activity, setActivity] = useState<MobileMatchActivityDto | null>(null);
  const notificationsRef = useRef<InAppNotification[]>([]);
  const preferencesRef = useRef(DEFAULT_PREFERENCES);
  const initialized = useRef(false);
  const previousLiveIds = useRef(new Set<string>());
  const previousRatingIds = useRef(new Set<string>());
  const eventIdsByMatch = useRef(new Map<string, Set<string>>());
  const persistenceQueue = useRef(Promise.resolve());
  const userId = session?.user.id ?? null;

  const replaceNotifications = useCallback((next: InAppNotification[]) => {
    const limited = next.slice(0, MAX_NOTIFICATIONS);
    notificationsRef.current = limited;
    setNotifications(limited);
    persistenceQueue.current = persistenceQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(limited)))
      .catch(() => undefined);
  }, []);

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
    void AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY).then((raw) => {
      if (!active) return;
      const stored = parseNotifications(raw);
      notificationsRef.current = stored;
      setNotifications(stored);
    }).finally(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    return subscribeToForegroundPushNotifications((push) => {
      const type = push.data.type;
      if (!notificationAllowed(type, preferencesRef.current)) return;
      const kind: InAppNotificationKind = type === 'match_start'
        ? 'match_live'
        : type === 'rating_open'
          ? 'rating_open'
          : type === 'match_event'
            ? 'match_event'
            : 'post_activity';
      const matchId = typeof push.data.matchId === 'string' ? push.data.matchId : null;
      const eventId = typeof push.data.eventId === 'string' ? push.data.eventId : null;
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
  }, [hydrated, publishNotification]);

  useEffect(() => {
    initialized.current = false;
    previousLiveIds.current = new Set();
    previousRatingIds.current = new Set();
    eventIdsByMatch.current = new Map();
    setActivity(null);
    preferencesRef.current = DEFAULT_PREFERENCES;
    if (!hydrated || !userId) return;

    let active = true;
    const loadActivity = async () => {
      try {
        const next = await fetchMobileApi<MobileMatchActivityDto>('/api/mobile/v1/me/match-activity');
        if (!active) return;
        const preferences = next.notificationPreferences;
        preferencesRef.current = preferences;

        if (initialized.current && preferences.inAppEnabled) {
          if (preferences.matchStartEnabled) {
            for (const match of next.liveMatches) {
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
          }
          if (preferences.ratingOpenEnabled) {
            for (const rating of next.ratings) {
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
        }

        previousLiveIds.current = new Set(next.liveMatches.map((match) => match.id));
        previousRatingIds.current = new Set(next.ratings.map((rating) => rating.id));
        initialized.current = true;
        setActivity(next);
      } catch {
        // 전역 보조 기능이므로 일시적인 네트워크 오류가 화면 탐색을 막지 않게 한다.
      }
    };

    void loadActivity();
    const interval = setInterval(() => void loadActivity(), ACTIVITY_POLL_MS);
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
    if (!hydrated || !userId || !activity?.notificationPreferences.inAppEnabled || !activity.notificationPreferences.matchEventsEnabled || activity.liveMatches.length === 0) return;
    let active = true;
    const pollEvents = async () => {
      await Promise.all(activity.liveMatches.map(async (match: MobileLiveMatchActivity) => {
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
    const interval = setInterval(() => void pollEvents(), LIVE_EVENT_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activity, hydrated, publishNotification, userId]);

  const markNotificationRead = useCallback((id: string) => {
    const readAt = new Date().toISOString();
    replaceNotifications(notificationsRef.current.map((item) => item.id === id && !item.readAt ? { ...item, readAt } : item));
  }, [replaceNotifications]);

  const markAllNotificationsRead = useCallback(() => {
    const readAt = new Date().toISOString();
    replaceNotifications(notificationsRef.current.map((item) => item.readAt ? item : { ...item, readAt }));
  }, [replaceNotifications]);

  const removeNotification = useCallback((id: string) => {
    replaceNotifications(notificationsRef.current.filter((item) => item.id !== id));
  }, [replaceNotifications]);

  const clearNotifications = useCallback(() => replaceNotifications([]), [replaceNotifications]);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const value = useMemo<NotificationContextValue>(() => ({
    clearNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    removeNotification,
    unreadCount,
  }), [clearNotifications, markAllNotificationsRead, markNotificationRead, notifications, removeNotification, unreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useInAppNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useInAppNotifications must be used inside InAppNotificationsProvider');
  return value;
}
